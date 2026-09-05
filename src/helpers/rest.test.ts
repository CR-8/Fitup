import { describe, expect, test } from '@jest/globals';

import {
    buildFinalizeRestUpdate,
    computeFinalRestSeconds,
    getRemainingRestSeconds,
    getRestEndMs,
    isRestActive,
    needsAutoFinalize,
} from './rest';

/**
 * Rest is anchored on the set's `completedAt` plus its planned duration, and
 * read against the wall clock. `needsAutoFinalize` is what drives the automatic
 * move to the next set, so a paused rest that still reported "due" would step
 * over the pause and start the next set anyway — which is the failure these
 * cases exist to catch.
 */

const T0 = 1_700_000_000_000;

const set = (overrides: Record<string, unknown> = {}) =>
    ({
        completedAt: new Date(T0),
        restTime: 60,
        restCompletedAt: null,
        finalRestTime: null,
        pausedAt: null,
        pausedMs: 0,
        ...overrides,
    }) as never;

describe('rest remaining', () => {
    test('counts down from the planned rest', () => {
        expect(getRemainingRestSeconds(set(), T0)).toBe(60);
        expect(getRemainingRestSeconds(set(), T0 + 20_000)).toBe(40);
        expect(getRemainingRestSeconds(set(), T0 + 60_000)).toBe(0);
    });

    test('holds still while paused, however long the app is away', () => {
        const paused = set({ pausedAt: new Date(T0 + 20_000) });

        expect(getRemainingRestSeconds(paused, T0 + 20_000)).toBe(40);
        expect(getRemainingRestSeconds(paused, T0 + 25_000)).toBe(40);
        expect(getRemainingRestSeconds(paused, T0 + 620_000)).toBe(40);
    });

    test('resuming continues from the exact remaining time', () => {
        const resumed = set({ pausedAt: null, pausedMs: 600_000 });

        expect(getRemainingRestSeconds(resumed, T0 + 620_000)).toBe(40);
        expect(getRemainingRestSeconds(resumed, T0 + 660_000)).toBe(0);
    });

    test('a finalized rest has no remaining time', () => {
        expect(getRemainingRestSeconds(set({ restCompletedAt: new Date(T0) }), T0)).toBeNull();
        expect(getRemainingRestSeconds(set({ finalRestTime: 12 }), T0)).toBeNull();
    });
});

describe('when rest ends', () => {
    test('is the planned duration after the set completed', () => {
        expect(getRestEndMs(set(), T0)).toBe(T0 + 60_000);
    });

    test('moves out with a pause, so nothing downstream ends it early', () => {
        expect(getRestEndMs(set({ pausedMs: 30_000 }), T0)).toBe(T0 + 90_000);
        expect(getRestEndMs(set({ pausedAt: new Date(T0 + 10_000) }), T0 + 40_000)).toBe(
            T0 + 90_000,
        );
    });
});

describe('the state machine reads a paused rest as still resting', () => {
    test('rest is active until the planned time is up', () => {
        expect(isRestActive(set(), T0 + 30_000)).toBe(true);
        expect(isRestActive(set(), T0 + 60_000)).toBe(false);
    });

    test('a paused rest stays active rather than falling through to the next set', () => {
        const paused = set({ pausedAt: new Date(T0 + 20_000) });

        expect(isRestActive(paused, T0 + 620_000)).toBe(true);
    });

    test('a paused rest is never due for auto-finalize', () => {
        // This is the guard that stops a pause from being stepped over: the
        // provider polls `needsAutoFinalize` once a second and would otherwise
        // finalize the rest and start the next set while the user is stopped.
        const paused = set({ pausedAt: new Date(T0 + 20_000) });

        expect(needsAutoFinalize(set(), T0 + 60_000)).toBe(true);
        expect(needsAutoFinalize(paused, T0 + 60_000)).toBe(false);
        expect(needsAutoFinalize(paused, T0 + 6_000_000)).toBe(false);
    });

    test('after resuming, it becomes due again at the shifted time', () => {
        const resumed = set({ pausedAt: null, pausedMs: 600_000 });

        expect(needsAutoFinalize(resumed, T0 + 620_000)).toBe(false);
        expect(needsAutoFinalize(resumed, T0 + 660_000)).toBe(true);
    });
});

describe('the rest that gets recorded', () => {
    test('is the wall time between the two stamps, capped at what was planned', () => {
        expect(computeFinalRestSeconds(set(), T0 + 25_000)).toBe(25);
        expect(computeFinalRestSeconds(set(), T0 + 90_000)).toBe(60);
    });

    test('excludes time spent paused', () => {
        // Ten minutes passed, but nine and a half of them were paused.
        const paused = set({ pausedMs: 570_000 });

        expect(computeFinalRestSeconds(paused, T0 + 600_000)).toBe(30);
    });

    test('finalizing clears the pause so nothing is left behind on the row', () => {
        expect(buildFinalizeRestUpdate(set({ pausedMs: 570_000 }), T0 + 600_000)).toEqual({
            restCompletedAt: new Date(T0 + 600_000),
            finalRestTime: 30,
            pausedAt: null,
            pausedMs: 0,
        });
    });
});
