import { ExerciseSetSelect } from '@/db/schema';
import { toMs } from './values';

export type PausableSet = Pick<ExerciseSetSelect, 'pausedAt' | 'pausedMs'>;

/**
 * Pausing a phase, without a second clock.
 *
 * Nothing in the app stores elapsed time — work counts from `startedAt`, rest
 * from `completedAt`, and both are read against the wall clock. So a pause
 * cannot be "stop counting"; it has to be "count, then subtract".
 *
 * The offset below grows at exactly the rate of the clock while `pausedAt` is
 * set, which is what makes `now - anchor - offset` and `anchor + planned +
 * offset` hold still on their own. No consumer has to know a pause is in
 * progress in order to stop moving.
 */

export const isSetPaused = (set: PausableSet | null | undefined): boolean => set?.pausedAt != null;

export const getPauseOffsetMs = (set: PausableSet | null | undefined, nowMs: number): number => {
    if (!set) return 0;

    const banked = Math.max(0, set.pausedMs ?? 0);
    const pausedAtMs = toMs(set.pausedAt);
    if (pausedAtMs == null) return banked;

    // Clamp: a clock that moved backwards must not refund banked time.
    return banked + Math.max(0, nowMs - pausedAtMs);
};

/** Pausing twice is the same as pausing once — the first instant is the true one. */
export const buildPauseUpdate = (
    set: PausableSet | null | undefined,
    nowMs: number = Date.now(),
): Partial<ExerciseSetSelect> | null => {
    if (isSetPaused(set)) return null;
    return { pausedAt: new Date(nowMs) };
};

/** Resuming banks the pause that just ended and clears the marker. */
export const buildResumeUpdate = (
    set: PausableSet | null | undefined,
    nowMs: number = Date.now(),
): Partial<ExerciseSetSelect> | null => {
    if (!isSetPaused(set)) return null;
    return { pausedAt: null, pausedMs: getPauseOffsetMs(set, nowMs) };
};

/** Cleared when a set completes, so its rest phase starts from zero again. */
export const RESET_PAUSE_UPDATE = { pausedAt: null, pausedMs: 0 } as const;
