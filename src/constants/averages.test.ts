import { describe, expect, test } from '@jest/globals';

import { GUIDELINE_SESSIONS_PER_WEEK, MEDIAN_AGE_YEARS, worldAverages } from '@/constants/averages';

/**
 * These numbers are shown side by side, so they have to agree with each other.
 * Editing a height without its BMI, or pasting a weight from a different survey,
 * would produce a pair implying a body nobody has — which is worse than showing
 * no hint at all.
 */

const weightAtBmi = (heightCm: number, bmi: number): number => bmi * (heightCm / 100) ** 2;

describe('world averages', () => {
    // Asserted on the weight rather than the BMI it implies: the figure shown is
    // a whole number of kilograms, and at these heights one kilogram of rounding
    // is worth about 0.12 BMI, which would make a tolerance on BMI either
    // meaningless or wrong.
    const meanBmiBySex: ['male' | 'female', number][] = [
        ['male', 24.5],
        ['female', 24.8],
    ];

    test.each(meanBmiBySex)('%s weight is its own height at the mean BMI', (sex, meanBmi) => {
        const { heightCm, bodyWeightKg } = worldAverages(sex);

        expect(Math.abs(bodyWeightKg - weightAtBmi(heightCm, meanBmi))).toBeLessThanOrEqual(0.5);
    });

    test('men are taller and heavier than women, as the source says', () => {
        const male = worldAverages('male');
        const female = worldAverages('female');

        expect(male.heightCm).toBeGreaterThan(female.heightCm);
        expect(male.bodyWeightKg).toBeGreaterThan(female.bodyWeightKg);
    });

    test.each([['other' as const], [null], [undefined]])(
        'falls back to the combined pair for %s',
        (sex) => {
            const combined = worldAverages(sex);
            const male = worldAverages('male');
            const female = worldAverages('female');

            expect(combined.heightCm).toBeGreaterThan(female.heightCm);
            expect(combined.heightCm).toBeLessThan(male.heightCm);
            expect(combined.bodyWeightKg).toBeGreaterThan(female.bodyWeightKg);
            expect(combined.bodyWeightKg).toBeLessThan(male.bodyWeightKg);
        },
    );

    test('every figure is a whole number, since these are typed into fields', () => {
        for (const sex of ['male', 'female', 'other'] as const) {
            const { heightCm, bodyWeightKg } = worldAverages(sex);

            expect(Number.isInteger(heightCm)).toBe(true);
            expect(Number.isInteger(bodyWeightKg)).toBe(true);
        }
    });

    test('the age and session hints stay plausible', () => {
        expect(MEDIAN_AGE_YEARS).toBeGreaterThanOrEqual(13);
        expect(MEDIAN_AGE_YEARS).toBeLessThanOrEqual(100);
        expect(GUIDELINE_SESSIONS_PER_WEEK).toBeGreaterThan(0);
        expect(GUIDELINE_SESSIONS_PER_WEEK).toBeLessThanOrEqual(14);
    });
});
