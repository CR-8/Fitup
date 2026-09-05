import { describe, expect, test } from '@jest/globals';

import { buildPauseUpdate, buildResumeUpdate, getPauseOffsetMs, isSetPaused } from './pause';

/**
 * Pause is an offset, not a second clock.
 *
 * Nothing in the app stores elapsed time — every readout is `now - anchor` —
 * so the only way to hold one still is to subtract time at exactly the rate
 * the clock adds it. These cases pin that arithmetic, because the moment it is
 * off by anything the timer either creeps forward while stopped or jumps on
 * resume.
 */

const T0 = 1_700_000_000_000;

const set = (pausedAt: Date | null, pausedMs = 0) => ({ pausedAt, pausedMs }) as never;

describe('the pause offset', () => {
    test('a set that was never paused owes nothing', () => {
        expect(getPauseOffsetMs(set(null), T0)).toBe(0);
        expect(isSetPaused(set(null))).toBe(false);
    });

    test('while paused it grows with the clock, so elapsed stops moving', () => {
        const paused = set(new Date(T0));

        expect(getPauseOffsetMs(paused, T0)).toBe(0);
        expect(getPauseOffsetMs(paused, T0 + 5_000)).toBe(5_000);
        expect(getPauseOffsetMs(paused, T0 + 60_000)).toBe(60_000);
    });

    test('a banked pause is carried, and a new one adds to it', () => {
        expect(getPauseOffsetMs(set(null, 9_000), T0)).toBe(9_000);
        expect(getPauseOffsetMs(set(new Date(T0), 9_000), T0 + 3_000)).toBe(12_000);
    });

    test('a clock that jumped backwards does not refund banked time', () => {
        // Device clock changes, DST, an NTP correction — none of these should
        // hand back time the user already spent stopped.
        expect(getPauseOffsetMs(set(new Date(T0), 4_000), T0 - 30_000)).toBe(4_000);
    });

    test('a missing or absent set reads as running', () => {
        expect(getPauseOffsetMs(null, T0)).toBe(0);
        expect(getPauseOffsetMs(undefined, T0)).toBe(0);
        expect(isSetPaused(null)).toBe(false);
    });
});

describe('pausing and resuming', () => {
    test('pausing records the instant it began', () => {
        expect(buildPauseUpdate(set(null), T0)).toEqual({ pausedAt: new Date(T0) });
    });

    test('pausing an already-paused set is a no-op, not a second start', () => {
        // Two taps on a stale render must not reset the pause to now and lose
        // the time already banked against it.
        expect(buildPauseUpdate(set(new Date(T0)), T0 + 10_000)).toBeNull();
    });

    test('resuming banks the pause that just ended and clears the marker', () => {
        expect(buildResumeUpdate(set(new Date(T0)), T0 + 7_000)).toEqual({
            pausedAt: null,
            pausedMs: 7_000,
        });
    });

    test('resuming accumulates across repeated pauses', () => {
        expect(buildResumeUpdate(set(new Date(T0), 4_000), T0 + 6_000)).toEqual({
            pausedAt: null,
            pausedMs: 10_000,
        });
    });

    test('resuming a running set is a no-op', () => {
        expect(buildResumeUpdate(set(null, 4_000), T0)).toBeNull();
    });
});
