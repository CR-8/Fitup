import dayjs from 'dayjs';

import {
    createWorkout,
    createWorkoutExercise,
    createWorkoutGroup,
    deleteWorkout,
    updateWorkout,
} from '@/crud/workout';
import { createExerciseSet } from '@/crud/exercise';
import { markPlanApplied } from '@/crud/ai';
import { createMealItems, deleteMealsForPlan, getOrCreateMeal, toDateKey } from '@/crud/nutrition';
import { reportError } from '@/services/error-reporting';
import type { PlanDiffRow } from '@/helpers/plan-diff';
import type { AiPlanPayload, AiPlanWorkout } from '@/types/ai';

/**
 * Commits a generated plan into the real schedule.
 *
 * Everything here goes through existing workout CRUD so the sync queue, timestamps,
 * and grouping behave exactly as they do for a hand-built workout. There is no second
 * write path into the workout domain.
 *
 * Only `planned` workouts are ever touched. Completed and in-progress sessions are the
 * user's training history and are never modified by generation.
 *
 * A session the plan replaces or drops is set to `cancelled`, never deleted, so
 * undo can restore it. The plan row remembers which ones in `appliedWorkoutIds`,
 * beside the workouts it created: a restorable id is stored as `~<id>`. (A
 * column of its own would need a migration on both the local and the backup
 * schema; this keeps the record in the one place the plan already lives.)
 */

const RESTORE_PREFIX = '~';

/** The workouts an applied plan created, without the ones it cancelled. */
export const createdWorkoutIds = (appliedWorkoutIds: string[] | null | undefined): string[] =>
    (appliedWorkoutIds ?? []).filter((id) => !id.startsWith(RESTORE_PREFIX));

/** The workouts an applied plan cancelled, which undo restores. */
export const cancelledWorkoutIds = (appliedWorkoutIds: string[] | null | undefined): string[] =>
    (appliedWorkoutIds ?? [])
        .filter((id) => id.startsWith(RESTORE_PREFIX))
        .map((id) => id.slice(RESTORE_PREFIX.length));

export interface ApplyPlanResult {
    workoutIds: string[];
    skipped: number;
    /** Meals written into the diet log. */
    mealsCreated: number;
}

const resolveStartAt = (dayOffset: number, startDate: Date): Date =>
    dayjs(startDate).add(dayOffset, 'day').hour(9).minute(0).second(0).millisecond(0).toDate();

const applyWorkout = async (
    planWorkout: AiPlanWorkout,
    userId: string,
    startDate: Date,
): Promise<string> => {
    const created = await createWorkout({
        name: planWorkout.name,
        status: 'planned',
        startAt: resolveStartAt(planWorkout.dayOffset, startDate),
        userId,
    });

    // One group per exercise, matching how the editor lays out a plain workout.
    for (let index = 0; index < planWorkout.exercises.length; index += 1) {
        const planExercise = planWorkout.exercises[index];

        const group = await createWorkoutGroup({
            workoutId: created.id,
            type: 'single',
            order: index,
        });

        const link = await createWorkoutExercise({
            workoutId: created.id,
            exerciseId: planExercise.exerciseId,
            groupId: group.id,
            orderInGroup: 0,
        });

        // Ramp-up sets come out of the front of the exercise's own set count
        // rather than being appended, so the number of sets the plan showed is
        // the number that gets created. `warmup` is a type the schema already
        // has and that working-volume stats already exclude.
        const warmupSets = Math.min(Math.max(planExercise.warmupSets ?? 0, 0), planExercise.sets);

        for (let setIndex = 0; setIndex < planExercise.sets; setIndex += 1) {
            const isWarmup = setIndex < warmupSets;

            await createExerciseSet({
                workoutExerciseId: link.id,
                order: setIndex,
                type: isWarmup ? 'warmup' : 'working',
                reps: planExercise.reps ?? null,
                // A ramp-up set is the same movement at a lighter load. There is
                // no prescribed number for that, and carrying the working weight
                // over would tell the user to warm up with their top set.
                weight: isWarmup ? null : (planExercise.weight ?? null),
                time: planExercise.timeSeconds ?? null,
                distance: planExercise.distance ?? null,
                restTime: planExercise.restSeconds ?? null,
            });
        }
    }

    return created.id;
};

/**
 * Writes a plan's meals into the diet log.
 *
 * Items land unticked: the plan says what to eat, and the user confirms what they
 * actually ate. Treating a generated plan as consumed would make the day's totals
 * fiction.
 */
const applyMeals = async (
    payload: AiPlanPayload,
    planId: string,
    userId: string,
    startDate: Date,
): Promise<number> => {
    let created = 0;

    for (const planMeal of payload.meals) {
        if (planMeal.items.length === 0) continue;

        const date = toDateKey(dayjs(startDate).add(planMeal.dayOffset, 'day').toDate());

        const target = await getOrCreateMeal({ userId, date, slot: planMeal.slot, planId });

        await createMealItems(
            planMeal.items.map((item, index) => ({
                mealId: target.id,
                name: item.name,
                quantity: item.quantity ?? null,
                calories: item.calories ?? null,
                proteinG: item.proteinG ?? null,
                carbsG: item.carbsG ?? null,
                fatG: item.fatG ?? null,
                order: index,
            })),
        );

        created += 1;
    }

    return created;
};

/**
 * Applies a plan, or the chosen part of it.
 *
 * With `rows` (the rows of `diffPlanAgainstSchedule` the user left on), only
 * those are applied: `new` and `replaces` create the session, `replaces` and
 * `removed` cancel the old one. Without it every session is created, as before.
 * `mealsCreated` follows the payload either way; meals are not part of the diff.
 */
export const applyPlanToSchedule = async (
    planId: string,
    payload: AiPlanPayload,
    userId: string,
    startDate: Date = new Date(),
    rows?: PlanDiffRow[],
): Promise<ApplyPlanResult> => {
    const workoutIds: string[] = [];
    const cancelledIds: string[] = [];
    let skipped = 0;
    let mealsCreated = 0;

    try {
        if (rows) {
            for (const row of rows) {
                if (row.kind === 'unchanged') continue;

                if (row.incoming && (row.kind === 'new' || row.kind === 'replaces')) {
                    workoutIds.push(await applyWorkout(row.incoming, userId, startDate));
                }
                if (row.existing && (row.kind === 'replaces' || row.kind === 'removed')) {
                    await updateWorkout(row.existing.id, { status: 'cancelled' });
                    cancelledIds.push(row.existing.id);
                }
            }
        } else {
            for (const planWorkout of payload.workouts) {
                if (planWorkout.exercises.length === 0) {
                    skipped += 1;
                    continue;
                }

                workoutIds.push(await applyWorkout(planWorkout, userId, startDate));
            }
        }

        mealsCreated = await applyMeals(payload, planId, userId, startDate);

        await markPlanApplied(planId, [
            ...workoutIds,
            ...cancelledIds.map((id) => `${RESTORE_PREFIX}${id}`),
        ]);

        return { workoutIds, skipped, mealsCreated };
    } catch (error) {
        // A partially applied plan is worse than none: the user would be left with an
        // incoherent schedule and no clear way to tell which parts came from where.
        // Roll back what was created, and bring back what was cancelled, before
        // surfacing the failure.
        for (const workoutId of workoutIds) {
            try {
                await deleteWorkout(workoutId);
            } catch (cleanupError) {
                reportError(cleanupError, 'Failed to roll back a partially applied AI plan');
            }
        }
        for (const workoutId of cancelledIds) {
            try {
                await updateWorkout(workoutId, { status: 'planned' });
            } catch (cleanupError) {
                reportError(cleanupError, 'Failed to restore a session after a failed plan');
            }
        }

        try {
            await deleteMealsForPlan(planId);
        } catch (cleanupError) {
            reportError(cleanupError, 'Failed to roll back meals from a partially applied plan');
        }

        reportError(error, 'Failed to apply AI plan to schedule');
        throw error;
    }
};

/**
 * Undo: removes everything a plan created (scheduled workouts and logged meals
 * alike) and restores the sessions it cancelled, leaving hand-entered records
 * and completed history untouched. Takes the plan's `appliedWorkoutIds` as
 * stored, restorable ids included.
 */
export const revertAppliedPlan = async (
    appliedWorkoutIds: string[],
    planId?: string,
): Promise<void> => {
    const workoutIds = createdWorkoutIds(appliedWorkoutIds);

    if (planId) {
        try {
            await deleteMealsForPlan(planId);
        } catch (error) {
            reportError(error, 'Failed to remove meals while undoing a plan');
        }
    }

    for (const workoutId of workoutIds) {
        try {
            await deleteWorkout(workoutId);
        } catch (error) {
            reportError(error, 'Failed to revert an applied AI plan workout');
        }
    }

    for (const workoutId of cancelledWorkoutIds(appliedWorkoutIds)) {
        try {
            await updateWorkout(workoutId, { status: 'planned' });
        } catch (error) {
            reportError(error, 'Failed to restore a session cancelled by an AI plan');
        }
    }
};
