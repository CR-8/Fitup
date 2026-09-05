import { ExerciseSetSelect } from '@/db/schema';
import { getPauseOffsetMs } from './pause';
import { toMs } from './values';

export type TimedSet = Pick<
    ExerciseSetSelect,
    'startedAt' | 'completedAt' | 'pausedAt' | 'pausedMs'
>;

/**
 * The work half of a set's clock.
 *
 * Both readouts were previously open-coded in four places, each re-deriving
 * `startedAt` through the same `instanceof Date` / `typeof number` ladder. They
 * are here so the pause offset applies in one place rather than four, and so
 * the arithmetic can be tested without a renderer.
 */

const activeStartMs = (set: TimedSet | null | undefined): number | null => {
    if (!set || !set.startedAt || set.completedAt) return null;
    return toMs(set.startedAt);
};

/** Wall time since the set began, minus anything spent paused. */
export const getWorkElapsedSeconds = (
    set: TimedSet | null | undefined,
    nowMs: number,
): number | null => {
    const startedAtMs = activeStartMs(set);
    if (startedAtMs == null) return null;

    const elapsedMs = nowMs - startedAtMs - getPauseOffsetMs(set, nowMs);
    return Math.max(0, Math.floor(elapsedMs / 1000));
};

/** Count-up readout for `timeOptions === 'stopwatch'`. */
export const getStopwatchElapsedSeconds = getWorkElapsedSeconds;

/** Countdown readout for `timeOptions === 'timer'`. Null when the set has no planned duration. */
export const getWorkTimerRemainingSeconds = (
    set: TimedSet | null | undefined,
    plannedSeconds: number | null | undefined,
    nowMs: number,
): number | null => {
    const plannedSec = Math.max(0, plannedSeconds ?? 0);
    if (plannedSec <= 0) return null;

    const elapsedSec = getWorkElapsedSeconds(set, nowMs);
    if (elapsedSec == null) return null;

    return Math.max(0, plannedSec - elapsedSec);
};

/**
 * When a timed set's work interval actually ended.
 *
 * Used as the recorded `completedAt` on auto-completion, so a set paused
 * mid-interval is not credited with the time the user spent stopped.
 */
export const getWorkEndMs = (
    set: TimedSet | null | undefined,
    plannedSeconds: number | null | undefined,
): number | null => {
    const startedAtMs = activeStartMs(set);
    if (startedAtMs == null) return null;

    const plannedSec = Math.max(0, plannedSeconds ?? 0);
    if (plannedSec <= 0) return null;

    // The banked total only; a set at zero remaining is by definition not paused.
    return startedAtMs + plannedSec * 1000 + Math.max(0, set?.pausedMs ?? 0);
};
