import { describe, expect, jest, test } from '@jest/globals';

/**
 * `helpers/workouts` reaches `helpers/times`, which loads i18n and through it
 * Sentry's native module. None of that is involved in date arithmetic; it is
 * mocked so these stay pure-function tests.
 */
jest.mock('@/locale/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startOfWeekMs, summariseWeek } = require('@/helpers/workouts');

/**
 * The home screen's three figures are only meaningful if "this week" means the
 * same thing everywhere on the screen. The week strip, the completed sections
 * and these numbers all bucket by the same boundary, and it moves with the
 * user's `firstWeekday` setting — so an off-by-one day here shows someone a
 * session count that disagrees with the dots directly beneath it.
 */

const WEDNESDAY = new Date(2026, 8, 2, 12, 0, 0); // 2 Sep 2026, a Wednesday.

const workout = (completedAt: Date | null, duration: number | null = 3600) => ({
    id: Math.random().toString(36).slice(2),
    status: completedAt ? ('completed' as const) : ('planned' as const),
    completedAt,
    duration,
});

/** Month is a JS index: 7 is August, 8 is September. */
const at = (day: number, month = 8, hour = 10) => new Date(2026, month, day, hour, 0, 0);

/** Sun 30 Aug 2026 — last week under a Monday start, this week under a Sunday one. */
const SUNDAY_BEFORE = at(30, 7);

describe('when the week starts', () => {
    test('Monday-start puts a Wednesday in the same week as the Monday before it', () => {
        const since = startOfWeekMs(2, WEDNESDAY);

        expect(new Date(since).getDate()).toBe(31); // Mon 31 Aug
        expect(new Date(since).getHours()).toBe(0);
    });

    test('Sunday-start moves the boundary a day earlier', () => {
        const since = startOfWeekMs(1, WEDNESDAY);

        expect(new Date(since).getDate()).toBe(30); // Sun 30 Aug
    });

    test('the boundary is local midnight, not the time of day it was asked', () => {
        const since = new Date(startOfWeekMs(2, WEDNESDAY));

        expect([since.getHours(), since.getMinutes(), since.getSeconds()]).toEqual([0, 0, 0]);
    });
});

describe('summarising the week so far', () => {
    test('counts completed workouts and adds their durations', () => {
        const summary = summariseWeek(
            [workout(at(1), 1800), workout(at(2), 2700)] as never,
            2,
            WEDNESDAY,
        );

        expect(summary).toEqual({ sessions: 2, durationSeconds: 4500 });
    });

    // The regression this guards: a workout from Sunday night is last week under
    // a Monday start, and counting it inflates every figure on the screen.
    test('last week is excluded', () => {
        const summary = summariseWeek(
            [workout(SUNDAY_BEFORE, 3600), workout(at(2), 1800)] as never,
            2,
            WEDNESDAY,
        );

        expect(summary.sessions).toBe(1);
        expect(summary.durationSeconds).toBe(1800);
    });

    test('that same workout counts when the week starts on Sunday', () => {
        const summary = summariseWeek([workout(SUNDAY_BEFORE, 3600)] as never, 1, WEDNESDAY);

        expect(summary.sessions).toBe(1);
    });

    test('planned and in-progress workouts are not sessions yet', () => {
        const summary = summariseWeek(
            [
                { id: 'a', status: 'planned', completedAt: null, duration: null },
                { id: 'b', status: 'in_progress', completedAt: null, duration: null },
            ] as never,
            2,
            WEDNESDAY,
        );

        expect(summary).toEqual({ sessions: 0, durationSeconds: 0 });
    });

    test('a workout with no recorded duration still counts as a session', () => {
        const summary = summariseWeek([workout(at(2), null)] as never, 2, WEDNESDAY);

        expect(summary).toEqual({ sessions: 1, durationSeconds: 0 });
    });

    test('no workouts is zero, not a crash', () => {
        expect(summariseWeek([], 2, WEDNESDAY)).toEqual({ sessions: 0, durationSeconds: 0 });
    });
});
