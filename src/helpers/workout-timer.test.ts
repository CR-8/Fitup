import { describe, expect, test } from '@jest/globals';

import {
    getStopwatchElapsedSeconds,
    getWorkElapsedSeconds,
    getWorkEndMs,
    getWorkTimerRemainingSeconds,
} from './workout-timer';

/**
 * The work half of a set's clock.
 *
 * Both readouts are derived from `startedAt` against the wall clock, which is
 * why backgrounding the app was never a problem for accuracy — and exactly why
 * pausing was. The cases below cover both: a large jump in `nowMs` stands in
 * for the app being away, and the paused ones pin that the readout does not
 * move while it is away.
 */

const T0 = 1_700_000_000_000;

const set = (overrides: Record<string, unknown> = {}) =>
    ({
        startedAt: new Date(T0),
        completedAt: null,
        pausedAt: null,
        pausedMs: 0,
        ...overrides,
    }) as never;

describe('the countdown', () => {
    test('counts down from the planned duration', () => {
        expect(getWorkTimerRemainingSeconds(set(), 60, T0)).toBe(60);
        expect(getWorkTimerRemainingSeconds(set(), 60, T0 + 20_000)).toBe(40);
    });

    test('stops at zero rather than going negative', () => {
        expect(getWorkTimerRemainingSeconds(set(), 60, T0 + 90_000)).toBe(0);
    });

    test('reaches zero exactly on the planned second', () => {
        expect(getWorkTimerRemainingSeconds(set(), 60, T0 + 59_999)).toBe(1);
        expect(getWorkTimerRemainingSeconds(set(), 60, T0 + 60_000)).toBe(0);
    });

    test('holds still while paused, however long the app is away', () => {
        // Paused at 20s in, then the app is backgrounded for ten minutes.
        const paused = set({ pausedAt: new Date(T0 + 20_000) });

        expect(getWorkTimerRemainingSeconds(paused, 60, T0 + 20_000)).toBe(40);
        expect(getWorkTimerRemainingSeconds(paused, 60, T0 + 25_000)).toBe(40);
        expect(getWorkTimerRemainingSeconds(paused, 60, T0 + 620_000)).toBe(40);
    });

    test('resuming continues from the exact remaining time', () => {
        // Paused at 20s in for 600s, then resumed: 40s should still be left,
        // and it should start moving again from there.
        const resumed = set({ pausedAt: null, pausedMs: 600_000 });

        expect(getWorkTimerRemainingSeconds(resumed, 60, T0 + 620_000)).toBe(40);
        expect(getWorkTimerRemainingSeconds(resumed, 60, T0 + 625_000)).toBe(35);
        expect(getWorkTimerRemainingSeconds(resumed, 60, T0 + 680_000)).toBe(0);
    });

    test('a set with no planned duration has no countdown', () => {
        expect(getWorkTimerRemainingSeconds(set(), 0, T0)).toBeNull();
        expect(getWorkTimerRemainingSeconds(set(), null, T0)).toBeNull();
    });

    test('a set that has not started, or has finished, has no countdown', () => {
        expect(getWorkTimerRemainingSeconds(set({ startedAt: null }), 60, T0)).toBeNull();
        expect(getWorkTimerRemainingSeconds(set({ completedAt: new Date(T0) }), 60, T0)).toBeNull();
    });
});

describe('the stopwatch', () => {
    test('counts up from the start', () => {
        expect(getStopwatchElapsedSeconds(set(), T0)).toBe(0);
        expect(getStopwatchElapsedSeconds(set(), T0 + 90_000)).toBe(90);
    });

    test('holds still while paused and resumes from where it stopped', () => {
        const paused = set({ pausedAt: new Date(T0 + 30_000) });
        expect(getStopwatchElapsedSeconds(paused, T0 + 30_000)).toBe(30);
        expect(getStopwatchElapsedSeconds(paused, T0 + 300_000)).toBe(30);

        const resumed = set({ pausedAt: null, pausedMs: 270_000 });
        expect(getStopwatchElapsedSeconds(resumed, T0 + 300_000)).toBe(30);
        expect(getStopwatchElapsedSeconds(resumed, T0 + 305_000)).toBe(35);
    });

    test('never reads negative if the clock moved backwards', () => {
        expect(getStopwatchElapsedSeconds(set(), T0 - 5_000)).toBe(0);
    });
});

/**
 * An ordinary reps set has no configured duration — `timeOptions` is 'log', or
 * null, which is most of the catalogue. The timer screen still counts up on it,
 * because a screen whose whole point is the clock cannot show nothing for the
 * commonest kind of workout. That is what these pin: elapsed depends on the set
 * having started, never on it having a planned `time`.
 */
describe('a set with no planned duration', () => {
    test('still reports elapsed seconds', () => {
        expect(getWorkElapsedSeconds(set({ time: null }), T0 + 45_000)).toBe(45);
    });

    test('still freezes while paused and resumes where it stopped', () => {
        const paused = set({ time: null, pausedAt: new Date(T0 + 45_000) });
        expect(getWorkElapsedSeconds(paused, T0 + 300_000)).toBe(45);

        const resumed = set({ time: null, pausedAt: null, pausedMs: 255_000 });
        expect(getWorkElapsedSeconds(resumed, T0 + 300_000)).toBe(45);
    });

    test('has nothing to report before the set starts', () => {
        expect(getWorkElapsedSeconds(set({ time: null, startedAt: null }), T0)).toBeNull();
    });
});

describe('when a timed set actually ended', () => {
    test('is the planned duration after the start when it never paused', () => {
        expect(getWorkEndMs(set(), 60)).toBe(T0 + 60_000);
    });

    test('is pushed out by time spent paused, so the pause is not credited as work', () => {
        expect(getWorkEndMs(set({ pausedMs: 600_000 }), 60)).toBe(T0 + 660_000);
    });

    test('is unknown for a set with no start or no planned duration', () => {
        expect(getWorkEndMs(set({ startedAt: null }), 60)).toBeNull();
        expect(getWorkEndMs(set(), 0)).toBeNull();
    });
});
