import { describe, expect, test } from '@jest/globals';

import { buildPersonalRecords, type PersonalRecordRow } from '@/helpers/personal-records';

const exercise = (id: string, tracking: string[]) =>
    ({ id, name: id, tracking, weightUnits: 'kg' }) as never;

let setCounter = 0;
const set = (fields: { weight?: number; reps?: number; time?: number; type?: string }) =>
    ({
        id: `set-${(setCounter += 1)}`,
        type: fields.type ?? 'working',
        weight: fields.weight ?? null,
        reps: fields.reps ?? null,
        time: fields.time ?? null,
        distance: null,
    }) as never;

const day = (date: number) => new Date(2026, 9, date, 18, 0, 0);

const BENCH = exercise('bench', ['weight', 'reps']);
const PUSHUP = exercise('pushup', ['reps']);
const PLANK = exercise('plank', ['time']);

const row = (
    ex: PersonalRecordRow['exercise'],
    s: PersonalRecordRow['set'],
    date: number,
): PersonalRecordRow => ({ exercise: ex, set: s, workoutCompletedAt: day(date) });

describe('personal records', () => {
    test('one record per exercise, judged on what the exercise tracks', () => {
        const records = buildPersonalRecords([
            row(BENCH, set({ weight: 60, reps: 8 }), 1),
            row(BENCH, set({ weight: 70, reps: 5 }), 3),
            row(PUSHUP, set({ reps: 20 }), 2),
            row(PUSHUP, set({ reps: 25 }), 4),
            row(PLANK, set({ time: 90 }), 5),
        ]);

        expect(
            records.map((record) => [
                record.exercise.id,
                record.set.weight ?? record.set.reps ?? record.set.time,
            ]),
        ).toEqual([
            ['plank', 90],
            ['pushup', 25],
            ['bench', 70],
        ]);
    });

    test('a warm-up never holds a record', () => {
        const [record] = buildPersonalRecords([
            row(BENCH, set({ weight: 100, reps: 3, type: 'warmup' }), 1),
            row(BENCH, set({ weight: 80, reps: 5 }), 1),
        ]);

        expect(record.set.weight).toBe(80);
    });

    test('equal load is broken by reps', () => {
        const [record] = buildPersonalRecords([
            row(BENCH, set({ weight: 80, reps: 5 }), 1),
            row(BENCH, set({ weight: 80, reps: 6 }), 2),
        ]);

        expect(record.set.reps).toBe(6);
        expect(record.achievedAt).toEqual(day(2));
    });

    // Matching a record later is not setting one.
    test('an exact tie keeps the date it was first reached', () => {
        const [record] = buildPersonalRecords([
            row(BENCH, set({ weight: 80, reps: 5 }), 9),
            row(BENCH, set({ weight: 80, reps: 5 }), 2),
        ]);

        expect(record.achievedAt).toEqual(day(2));
    });

    test('newest record first', () => {
        const records = buildPersonalRecords([
            row(PUSHUP, set({ reps: 30 }), 1),
            row(BENCH, set({ weight: 50, reps: 5 }), 7),
        ]);

        expect(records.map((record) => record.exercise.id)).toEqual(['bench', 'pushup']);
    });

    test('an exercise with nothing measurable is left out', () => {
        expect(buildPersonalRecords([row(BENCH, set({}), 1)])).toEqual([]);
    });
});
