import { describe, expect, test } from '@jest/globals';

import { derivePlanProgress, summarisePlans } from './ai-plan';

/**
 * Guards the arithmetic behind "Week 2 of 8 — 7 of 32 sessions done".
 *
 * None of this is checkable by eye: every wrong answer is still a number in the
 * right shape, sitting in a card that looks finished. A plan applied this
 * morning reading "Week 0" or a plan two months past its horizon reading
 * "Week 9 of 8" both render perfectly happily.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 10);

/** Workout rows for `count` of the plan's sessions, marked completed. */
const completed = (count: number) =>
    Array.from({ length: count }, (_, at) => ({
        id: `w-${at}`,
        status: 'completed',
    })) as never[];

const planRow = (
    overrides: { horizonDays?: number; workouts?: number; appliedAt?: number | null } = {},
) =>
    ({
        id: 'plan-1',
        userId: 'user-1',
        status: 'applied',
        appliedAt: overrides.appliedAt === undefined ? NOW : overrides.appliedAt,
        appliedWorkoutIds: Array.from({ length: overrides.workouts ?? 32 }, (_, at) => `w-${at}`),
        payload: {
            kind: 'workout',
            title: 'Lean Build — Upper Focus',
            horizonDays: overrides.horizonDays ?? 56,
            workouts: Array.from({ length: overrides.workouts ?? 32 }, (_, at) => ({
                name: `Session ${at + 1}`,
                dayOffset: at,
                exercises: [],
            })),
            meals: [],
            targets: [],
        },
    }) as never;

describe('which week the plan is on', () => {
    test('the day it is applied is week 1, not week 0', () => {
        expect(derivePlanProgress(planRow(), [], NOW).week).toBe(1);
    });

    test('six days in is still week 1', () => {
        expect(derivePlanProgress(planRow(), [], NOW + 6 * DAY).week).toBe(1);
    });

    test('day seven begins week 2', () => {
        expect(derivePlanProgress(planRow(), [], NOW + 7 * DAY).week).toBe(2);
    });

    test('a plan left running past its horizon stays on its last week', () => {
        // Ten weeks into an eight-week plan. Counting upward would read "week 11
        // of 8", which is the kind of thing that ships.
        const progress = derivePlanProgress(planRow(), [], NOW + 70 * DAY);

        expect(progress.week).toBe(8);
        expect(progress.weeks).toBe(8);
        expect(progress.finished).toBe(true);
    });

    test('a horizon that is not a whole number of weeks rounds up', () => {
        // Ten days is two weeks, the second one partial — not one.
        expect(derivePlanProgress(planRow({ horizonDays: 10 }), []).weeks).toBe(2);
    });

    test('a plan with no appliedAt does not read as applied in 1970', () => {
        const progress = derivePlanProgress(planRow({ appliedAt: null }), [], NOW);

        expect(progress.week).toBe(1);
        expect(progress.finished).toBe(false);
    });
});

describe('how many sessions are done', () => {
    test('counts what was completed out of what the plan holds', () => {
        const progress = derivePlanProgress(planRow(), completed(7), NOW);

        expect(progress.sessionsDone).toBe(7);
        expect(progress.sessionsTotal).toBe(32);
    });

    test('never reports more done than the plan contains', () => {
        // The count comes from workout rows, which a user can duplicate; the
        // card must not claim 34 of 32.
        expect(derivePlanProgress(planRow(), completed(34), NOW).sessionsDone).toBe(32);
    });

    test('an empty plan divides by nothing', () => {
        const progress = derivePlanProgress(planRow({ workouts: 0 }), [], NOW);

        expect(progress.sessionsTotal).toBe(0);
        expect(progress.perWeek).toBe(0);
        expect(Number.isFinite(progress.perWeek)).toBe(true);
    });

    test('sessions a week comes out of the plan, not a guess', () => {
        // 32 sessions over 8 weeks is 4 a week, which is the line the card shows.
        expect(derivePlanProgress(planRow(), [], NOW).perWeek).toBe(4);
    });
});

describe('when a plan is done with', () => {
    test('a plan with every session completed is complete before its horizon', () => {
        const progress = derivePlanProgress(
            planRow({ workouts: 4, horizonDays: 7 }),
            completed(4),
            NOW,
        );

        expect(progress.finished).toBe(false);
        expect(progress.complete).toBe(true);
    });

    test('a 3-day plan is finished on day 3, not rounded up to a week', () => {
        expect(derivePlanProgress(planRow({ horizonDays: 3 }), [], NOW + 2 * DAY).finished).toBe(
            false,
        );
        expect(derivePlanProgress(planRow({ horizonDays: 3 }), [], NOW + 3 * DAY).finished).toBe(
            true,
        );
    });

    test('a plan whose time is up is complete, sessions or not', () => {
        expect(derivePlanProgress(planRow({ horizonDays: 7 }), [], NOW + 8 * DAY).complete).toBe(
            true,
        );
    });
});

describe('which plan Home shows, and how many are behind the user', () => {
    const plan = (id: string, appliedAt: number, workouts = 4) =>
        ({
            ...(planRow({ appliedAt, workouts, horizonDays: 7 }) as object),
            id,
            appliedWorkoutIds: Array.from({ length: workouts }, (_, at) => `${id}-w-${at}`),
        }) as never;

    const done = (id: string, count: number) =>
        Array.from({ length: count }, (_, at) => ({
            id: `${id}-w-${at}`,
            status: 'completed',
        })) as never[];

    test('nothing applied is nothing running and nothing finished', () => {
        expect(summarisePlans([], [], NOW)).toEqual({ current: null, finished: 0 });
    });

    test('a plan mid-week is the current one', () => {
        const running = plan('a', NOW - 2 * DAY);

        expect(summarisePlans([running], [], NOW)).toEqual({ current: running, finished: 0 });
    });

    test('a completed plan stops being current and counts as finished', () => {
        expect(summarisePlans([plan('a', NOW - 2 * DAY)], done('a', 4), NOW)).toEqual({
            current: null,
            finished: 1,
        });
    });

    test('a plan replaced in its first week does not count as finished later', () => {
        const newer = plan('b', NOW - 20 * DAY);
        const abandoned = plan('a', NOW - 22 * DAY);

        // `newer` has run out too, so it counts; `abandoned` was two days in when replaced.
        expect(summarisePlans([newer, abandoned], [], NOW)).toEqual({ current: null, finished: 1 });
    });

    test('a plan that ran its course before the next one counts', () => {
        const newer = plan('b', NOW - 1 * DAY);
        const older = plan('a', NOW - 10 * DAY);

        expect(summarisePlans([newer, older], [], NOW)).toEqual({ current: newer, finished: 1 });
    });
});
