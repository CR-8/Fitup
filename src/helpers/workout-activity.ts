import type { ExerciseSetSelect } from '@/db/schema';

type DateLike = Date | number | string | null | undefined;
type ActivitySet = Pick<ExerciseSetSelect, 'startedAt' | 'completedAt' | 'restCompletedAt'>;

const ms = (value: DateLike): number | null => {
    if (value == null) return null;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

    return Number.isFinite(time) ? time : null;
};

/**
 * The last moment the user demonstrably did something in a workout: the latest
 * set `startedAt` / `completedAt` / `restCompletedAt`, else the workout's own
 * `startedAt`. Null when neither exists.
 *
 * A workout left `in_progress` overnight is only ever "finished" by the clock,
 * so this is the number a duration should be measured to instead.
 */
export const getLastActivityMs = (
    workoutStartedAt: DateLike,
    sets: readonly ActivitySet[],
): number | null => {
    let last: number | null = null;

    for (const set of sets) {
        for (const value of [set.startedAt, set.completedAt, set.restCompletedAt]) {
            const time = ms(value);
            if (time != null && (last == null || time > last)) last = time;
        }
    }

    return last ?? ms(workoutStartedAt);
};

/** Whether any set was completed, i.e. the last activity is real work rather than just the start. */
export const hasLoggedSet = (sets: readonly ActivitySet[]): boolean =>
    sets.some((set) => set.completedAt != null);

/** Past this gap since the last activity, a workout is treated as abandoned. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
/** Finishing later than this after the last set defaults to the last set's time. */
export const FINISH_GAP_MS = 30 * 60 * 1000;
/** A completed session longer than this is offered for review. */
export const IMPLAUSIBLE_DURATION_SEC = 4 * 60 * 60;
