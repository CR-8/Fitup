import { describe, expect, jest, test } from '@jest/globals';

/**
 * Same isolation as `week-summary.test.ts`: `helpers/workouts` reaches
 * `helpers/times`, which loads i18n and through it Sentry's native module. None
 * of that is involved in date arithmetic.
 */
jest.mock('@/locale/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeStreakDays } = require('@/helpers/workouts');

/** Month is a JS index: 8 is September. */
const at = (day: number, month = 8, hour = 10) => new Date(2026, month, day, hour, 0, 0);

/** Sat 5 Sep 2026, the day the figure is being read. */
const TODAY = at(5, 8, 12);

const workout = (completedAt: Date | null) => ({
    id: Math.random().toString(36).slice(2),
    status: completedAt ? ('completed' as const) : ('planned' as const),
    completedAt,
    duration: 3600,
});

/**
 * The streak is shown to the user as a fact about their training, so the ways
 * it can lie matter more than the happy path: counting a planned workout, or
 * counting across a day that was missed, both put a number on screen that the
 * calendar directly above it contradicts.
 */
describe('counting a training streak', () => {
    test('no workouts is no streak', () => {
        expect(computeStreakDays([], TODAY)).toBe(0);
    });

    test('counts consecutive days ending today', () => {
        const workouts = [workout(at(3)), workout(at(4)), workout(at(5))];

        expect(computeStreakDays(workouts as never, TODAY)).toBe(3);
    });

    // The grace day. Someone who trained four days straight and has not trained
    // yet this morning still has a streak of four, not zero.
    test('an untrained today keeps a run that ended yesterday', () => {
        const workouts = [workout(at(3)), workout(at(4))];

        expect(computeStreakDays(workouts as never, TODAY)).toBe(2);
    });

    test('a missed day ends the streak', () => {
        // Trained the 1st and 2nd, missed the 3rd, trained the 4th and 5th.
        const workouts = [workout(at(1)), workout(at(2)), workout(at(4)), workout(at(5))];

        expect(computeStreakDays(workouts as never, TODAY)).toBe(2);
    });

    test('two workouts on one day are one day of streak', () => {
        const workouts = [workout(at(5, 8, 8)), workout(at(5, 8, 19))];

        expect(computeStreakDays(workouts as never, TODAY)).toBe(1);
    });

    test('planned workouts are not training', () => {
        expect(computeStreakDays([workout(null)] as never, TODAY)).toBe(0);
    });

    test('a run that ended days ago is over', () => {
        const workouts = [workout(at(1)), workout(at(2))];

        expect(computeStreakDays(workouts as never, TODAY)).toBe(0);
    });
});
