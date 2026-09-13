import { describe, expect, test } from '@jest/globals';

import { summariseExerciseHistory } from './exercise-history';

const exercise = (tracking: string[]) => ({ tracking }) as never;

const set = (fields: Record<string, unknown>) =>
    ({ type: 'working', weight: null, reps: null, time: null, distance: null, ...fields }) as never;

const item = (completedAt: number | null, sets: unknown[]) =>
    ({ workout: { completedAt }, workoutExercise: { id: String(completedAt) }, sets }) as never;

describe('an exercise history summary', () => {
    test('nothing on record is no summary, not an empty card', () => {
        expect(summariseExerciseHistory(exercise(['weight', 'reps']), [])).toBeNull();
    });

    test('last performed is the newest session, which comes first', () => {
        const summary = summariseExerciseHistory(exercise(['reps']), [
            item(2000, [set({ reps: 10 }), set({ reps: 8 })]),
            item(1000, [set({ reps: 12 })]),
        ]);

        expect(summary?.lastPerformedAt?.getTime()).toBe(2000);
        expect(summary?.lastSetCount).toBe(2);
    });

    test('a weighted lift is judged on load, across every session', () => {
        const summary = summariseExerciseHistory(exercise(['weight', 'reps']), [
            item(2000, [set({ weight: 60, reps: 8 })]),
            item(1000, [set({ weight: 70, reps: 3 })]),
        ]);

        expect(summary?.bestSet).toMatchObject({ weight: 70 });
    });

    test('at equal load, more reps wins', () => {
        const summary = summariseExerciseHistory(exercise(['weight', 'reps']), [
            item(2000, [set({ weight: 60, reps: 5 }), set({ weight: 60, reps: 9 })]),
        ]);

        expect(summary?.bestSet).toMatchObject({ weight: 60, reps: 9 });
    });

    test('a bodyweight exercise is judged on reps', () => {
        const summary = summariseExerciseHistory(exercise(['reps']), [
            item(2000, [set({ reps: 12 }), set({ reps: 15 })]),
        ]);

        expect(summary?.bestSet).toMatchObject({ reps: 15 });
    });

    test('a warm-up is never the best set', () => {
        const summary = summariseExerciseHistory(exercise(['reps']), [
            item(2000, [set({ type: 'warmup', reps: 30 }), set({ reps: 12 })]),
        ]);

        expect(summary?.bestSet).toMatchObject({ reps: 12 });
    });
});
