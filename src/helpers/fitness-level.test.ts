import { describe, expect, test } from '@jest/globals';

import { resolveFitnessLevel } from './fitness-level';

describe('resolving a fitness level', () => {
    test('no completed workouts is beginner', () => {
        expect(resolveFitnessLevel({ workoutsCount: 0, trainingWeeks: 0 })).toBe('beginner');
    });

    test('a handful of sessions in the first weeks stays beginner', () => {
        expect(resolveFitnessLevel({ workoutsCount: 3, trainingWeeks: 2 })).toBe('beginner');
    });

    test('too sparse a cadence over a long span stays beginner, not novice', () => {
        // One session every three weeks for a year is not training consistently,
        // however long the calendar span is.
        expect(resolveFitnessLevel({ workoutsCount: 17, trainingWeeks: 52 })).toBe('beginner');
    });

    test('a few consistent weeks crosses into novice', () => {
        expect(resolveFitnessLevel({ workoutsCount: 12, trainingWeeks: 6 })).toBe('novice');
    });

    test('roughly half a year of consistent training reads as intermediate', () => {
        expect(resolveFitnessLevel({ workoutsCount: 78, trainingWeeks: 26 })).toBe('intermediate');
    });

    test('roughly two years of consistent training reads as advanced', () => {
        expect(resolveFitnessLevel({ workoutsCount: 300, trainingWeeks: 104 })).toBe('advanced');
    });

    test('relative strength absent leaves the training-age estimate untouched', () => {
        const withoutStrength = resolveFitnessLevel({ workoutsCount: 78, trainingWeeks: 26 });
        const withNullStrength = resolveFitnessLevel({
            workoutsCount: 78,
            trainingWeeks: 26,
            bestRelativeStrength: null,
        });

        expect(withNullStrength).toBe(withoutStrength);
    });

    test('strong relative strength moves a beginner-by-age estimate up one level, not two', () => {
        // Training age alone says beginner; an advanced-band ratio (2.0) is a
        // real outcome and should pull the result up, but only by one step —
        // a single lift's ratio should not override months of missing history.
        const result = resolveFitnessLevel({
            workoutsCount: 3,
            trainingWeeks: 2,
            bestRelativeStrength: 2.0,
        });

        expect(result).toBe('novice');
    });

    test('weak relative strength moves an advanced-by-age estimate down one level, not to beginner', () => {
        const result = resolveFitnessLevel({
            workoutsCount: 300,
            trainingWeeks: 104,
            bestRelativeStrength: 0.3,
        });

        expect(result).toBe('intermediate');
    });

    test('relative strength that agrees with training age leaves the level unchanged', () => {
        const result = resolveFitnessLevel({
            workoutsCount: 78,
            trainingWeeks: 26,
            bestRelativeStrength: 1.3,
        });

        expect(result).toBe('intermediate');
    });

    test('a non-finite relative strength is treated as absent', () => {
        const result = resolveFitnessLevel({
            workoutsCount: 78,
            trainingWeeks: 26,
            bestRelativeStrength: Number.NaN,
        });

        expect(result).toBe('intermediate');
    });
});
