import dayjs from 'dayjs';

import type { WorkoutSelect } from '@/db/schema';
import type { AiPlanPayload, AiPlanWorkout } from '@/types/ai';

/**
 * What applying a plan would do to the schedule, row by row.
 *
 * - `new`: a session on a day with nothing planned.
 * - `replaces`: a session on a day that already has a planned one; the old one
 *   is cancelled, not deleted, so undo can bring it back.
 * - `removed`: a planned session inside the plan's window that the plan no
 *   longer includes (only when the caller says it may be removed).
 * - `unchanged`: the same session is already there.
 *
 * Pure, with no database or React: it is arithmetic over the payload and the
 * rows the screen already holds. Completed, in-progress and cancelled workouts
 * never appear in it, so a diff cannot touch training history.
 */

export type PlanDiffKind = 'new' | 'replaces' | 'removed' | 'unchanged';

export interface PlanDiffRow {
    /** Stable for a given payload and schedule: `date#index`. */
    key: string;
    /** Local calendar day, `YYYY-MM-DD`. */
    date: string;
    incoming?: AiPlanWorkout;
    existing?: WorkoutSelect;
    kind: PlanDiffKind;
}

export interface PlanDiffOptions {
    /**
     * Workouts the plan may propose to remove. Anything not listed (a session
     * the user built by hand) is left alone when the plan has no session for its
     * day. Omit to never propose removals.
     */
    removableIds?: ReadonlySet<string>;
    /** Whether an existing session already is the incoming one. Default: never. */
    isSame?: (existing: WorkoutSelect, incoming: AiPlanWorkout) => boolean;
}

const dayKey = (value: Date | number | string | dayjs.Dayjs): string =>
    dayjs(value).format('YYYY-MM-DD');

export const diffPlanAgainstSchedule = (
    payload: AiPlanPayload,
    existingPlanned: WorkoutSelect[],
    startDate: Date,
    options: PlanDiffOptions = {},
): PlanDiffRow[] => {
    const { removableIds, isSame } = options;
    const start = dayjs(startDate).startOf('day');
    const windowEnd = start.add(Math.max(1, payload.horizonDays), 'day');

    const incomingByDay = new Map<string, AiPlanWorkout[]>();
    for (const workout of payload.workouts) {
        if (workout.exercises.length === 0) continue;

        const key = dayKey(start.add(workout.dayOffset, 'day'));
        incomingByDay.set(key, [...(incomingByDay.get(key) ?? []), workout]);
    }

    const existingByDay = new Map<string, WorkoutSelect[]>();
    for (const workout of existingPlanned) {
        if (workout.status !== 'planned' || !workout.startAt) continue;

        const key = dayKey(workout.startAt);
        existingByDay.set(key, [...(existingByDay.get(key) ?? []), workout]);
    }
    for (const list of existingByDay.values()) {
        list.sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
    }

    const rows: PlanDiffRow[] = [];
    const days = Array.from(new Set([...incomingByDay.keys(), ...existingByDay.keys()])).sort();

    for (const date of days) {
        const incoming = incomingByDay.get(date) ?? [];
        const existing = existingByDay.get(date) ?? [];
        const inWindow =
            !dayjs(date).isBefore(start, 'day') && dayjs(date).isBefore(windowEnd, 'day');
        let index = 0;

        // Same-day planned sessions are matched in order, as replacements.
        const paired = Math.min(incoming.length, existing.length);
        for (let i = 0; i < paired; i += 1) {
            rows.push({
                key: `${date}#${index++}`,
                date,
                incoming: incoming[i],
                existing: existing[i],
                kind: isSame?.(existing[i], incoming[i]) ? 'unchanged' : 'replaces',
            });
        }

        for (const workout of incoming.slice(paired)) {
            rows.push({ key: `${date}#${index++}`, date, incoming: workout, kind: 'new' });
        }

        for (const workout of existing.slice(paired)) {
            if (inWindow && removableIds?.has(workout.id)) {
                rows.push({ key: `${date}#${index++}`, date, existing: workout, kind: 'removed' });
            }
        }
    }

    return rows;
};

/** "3 sessions · 2 replaced · 1 removed", as numbers; the screen words it. */
export const summarisePlanDiff = (rows: PlanDiffRow[]) => ({
    sessions: rows.filter((row) => row.incoming && row.kind !== 'unchanged').length,
    replaced: rows.filter((row) => row.kind === 'replaces').length,
    removed: rows.filter((row) => row.kind === 'removed').length,
});
