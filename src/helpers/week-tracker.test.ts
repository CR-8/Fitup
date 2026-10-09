import { describe, expect, jest, test } from '@jest/globals';

/**
 * `helpers/workouts` reaches `helpers/times`, which loads i18n and through it
 * Sentry's native module — none of it involved in date arithmetic. Mocked, as in
 * week-summary.test.ts, so these stay pure-function tests.
 */
jest.mock('@/locale/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildWeekTracker } = require('@/helpers/week-tracker');

/** Wed 7 Oct 2026, mid-afternoon. Monday-start week: Mon 5 Oct – Sun 11 Oct. */
const NOW = new Date(2026, 9, 7, 15, 0, 0);

/** Month is a JS index: 9 is October. */
const at = (day: number, hour = 9) => new Date(2026, 9, day, hour, 0, 0);

let counter = 0;
const completed = (day: number, name = 'Push day') => ({
    id: `w${(counter += 1)}`,
    name,
    status: 'completed' as const,
    startAt: at(day),
    startedAt: at(day),
    completedAt: at(day, 10),
});
const planned = (day: number, name = 'Pull day') => ({
    id: `w${(counter += 1)}`,
    name,
    status: 'planned' as const,
    startAt: at(day),
    startedAt: null,
    completedAt: null,
});

const plan = (appliedDay: number, horizonDays = 7) => ({
    appliedAt: at(appliedDay, 8),
    payload: { horizonDays, workouts: [] },
});

const build = (overrides: Record<string, unknown>) =>
    buildWeekTracker({
        workouts: [],
        workoutTypes: new Map(),
        activePlan: null,
        sessionsPerWeek: 3,
        firstWeekday: 2,
        now: NOW,
        ...overrides,
    });

const statuses = (tracker: { days: { status: string }[] }) => tracker.days.map((day) => day.status);

describe('without a plan', () => {
    test('past days are trained or rested; today and later are open', () => {
        const tracker = build({ workouts: [completed(5)] });

        expect(statuses(tracker)).toEqual([
            'trained',
            'rested',
            'open',
            'open',
            'open',
            'open',
            'open',
        ]);
        expect(tracker.workouts).toEqual({ done: 1, target: 3 });
        expect(tracker.rest).toEqual({ done: 1, target: 4 });
        expect(tracker.activeRest).toEqual({ done: 0, target: 0 });
        expect(tracker.followsPlan).toBe(false);
    });

    test('a hand-built recovery session by name counts as active rest', () => {
        const tracker = build({ workouts: [completed(6, 'Mobility flow')] });

        expect(tracker.days[1].status).toBe('active_rest');
        expect(tracker.activeRest).toEqual({ done: 1, target: 1 });
        expect(tracker.workouts.done).toBe(0);
    });

    test('scheduling more than the profile asks raises the target', () => {
        const tracker = build({
            workouts: [planned(7), planned(8), planned(9), planned(10)],
        });

        expect(tracker.workouts.target).toBe(4);
    });

    test('last week and next week are ignored', () => {
        const tracker = build({ workouts: [completed(4), planned(12)] });

        expect(tracker.workouts.done).toBe(0);
        expect(statuses(tracker).every((status) => status === 'rested' || status === 'open')).toBe(
            true,
        );
    });
});

describe('following an AI plan', () => {
    const mon = completed(5);
    const tueActive = planned(6, 'Easy walk');
    const wed = planned(7);
    const fri = planned(9);
    const satActive = planned(10, 'Easy walk');
    const types = new Map([
        [tueActive.id, 'active_rest'],
        [satActive.id, 'active_rest'],
    ]);

    const tracker = build({
        workouts: [mon, tueActive, wed, fri, satActive],
        workoutTypes: types,
        activePlan: plan(5),
    });

    test('each day shows what the plan made of it', () => {
        expect(statuses(tracker)).toEqual([
            'trained', // Mon: done
            'rested', // Tue: active rest planned, skipped — still a day off
            'planned_workout', // Wed: today, not yet done
            'planned_rest', // Thu: plan leaves it free
            'planned_workout', // Fri
            'planned_active_rest', // Sat
            'planned_rest', // Sun
        ]);
        expect(tracker.days[2].isToday).toBe(true);
        expect(tracker.days[2].workoutId).toBe(wed.id);
    });

    test('targets come from the plan, not the profile', () => {
        expect(tracker.workouts).toEqual({ done: 1, target: 3 });
        expect(tracker.activeRest).toEqual({ done: 0, target: 2 });
        expect(tracker.rest).toEqual({ done: 1, target: 2 });
        expect(tracker.followsPlan).toBe(true);
    });

    test('a completed active-rest session counts', () => {
        const done = { ...tueActive, status: 'completed' as const, completedAt: at(6, 10) };
        const next = build({
            workouts: [mon, done, wed, fri, satActive],
            workoutTypes: types,
            activePlan: plan(5),
        });

        expect(next.days[1].status).toBe('active_rest');
        expect(next.activeRest).toEqual({ done: 1, target: 2 });
        expect(next.rest.done).toBe(0);
    });

    test('a scheduled session that was not done is missed, not rest', () => {
        const next = build({
            workouts: [planned(5), wed],
            activePlan: plan(5),
        });

        expect(next.days[0].status).toBe('missed');
        // Only Tuesday, which had nothing scheduled, is a rest day.
        expect(next.days[1].status).toBe('rested');
        expect(next.rest.done).toBe(1);
    });

    test('a plan rest day counts as taken from the morning of', () => {
        const next = build({ workouts: [mon], activePlan: plan(5) });

        expect(next.days[2]).toMatchObject({ isToday: true, status: 'rested' });
    });

    test('days the plan does not reach are open, not planned rest', () => {
        const next = build({ workouts: [], activePlan: plan(5, 3) });

        expect(statuses(next).slice(3)).toEqual(['open', 'open', 'open', 'open']);
    });
});

test('a Sunday-start week runs Sunday to Saturday', () => {
    const tracker = build({ firstWeekday: 1 });

    expect(tracker.days[0].date.getDay()).toBe(0);
    expect(tracker.days[0].date.getDate()).toBe(4);
    expect(tracker.days[6].date.getDate()).toBe(10);
});
