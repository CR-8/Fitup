import dayjs from 'dayjs';

import {
    createWorkout,
    createWorkoutExercise,
    createWorkoutGroup,
    deleteWorkout,
} from '@/crud/workout';
import { createExerciseSet } from '@/crud/exercise';
import { markPlanApplied } from '@/crud/ai';
import { reportError } from '@/services/error-reporting';
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
 */

export interface ApplyPlanResult {
    workoutIds: string[];
    skipped: number;
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

        for (let setIndex = 0; setIndex < planExercise.sets; setIndex += 1) {
            await createExerciseSet({
                workoutExerciseId: link.id,
                order: setIndex,
                type: 'working',
                reps: planExercise.reps ?? null,
                weight: planExercise.weight ?? null,
                time: planExercise.timeSeconds ?? null,
                distance: planExercise.distance ?? null,
                restTime: planExercise.restSeconds ?? null,
            });
        }
    }

    return created.id;
};

export const applyPlanToSchedule = async (
    planId: string,
    payload: AiPlanPayload,
    userId: string,
    startDate: Date = new Date(),
): Promise<ApplyPlanResult> => {
    const workoutIds: string[] = [];
    let skipped = 0;

    try {
        for (const planWorkout of payload.workouts) {
            if (planWorkout.exercises.length === 0) {
                skipped += 1;
                continue;
            }

            workoutIds.push(await applyWorkout(planWorkout, userId, startDate));
        }

        await markPlanApplied(planId, workoutIds);

        return { workoutIds, skipped };
    } catch (error) {
        // A partially applied plan is worse than none: the user would be left with an
        // incoherent schedule and no clear way to tell which parts came from where.
        // Roll back what was created before surfacing the failure.
        for (const workoutId of workoutIds) {
            try {
                await deleteWorkout(workoutId);
            } catch (cleanupError) {
                reportError(cleanupError, 'Failed to roll back a partially applied AI plan');
            }
        }

        reportError(error, 'Failed to apply AI plan to schedule');
        throw error;
    }
};

/** Undo: removes the workouts a plan created, leaving history untouched. */
export const revertAppliedPlan = async (workoutIds: string[]): Promise<void> => {
    for (const workoutId of workoutIds) {
        try {
            await deleteWorkout(workoutId);
        } catch (error) {
            reportError(error, 'Failed to revert an applied AI plan workout');
        }
    }
};
