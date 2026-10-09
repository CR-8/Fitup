import { describe, expect, test } from '@jest/globals';

import {
    ageToBirthday,
    birthdayToAge,
    isProfileComplete,
    missingProfileFields,
} from '@/helpers/profile';

const COMPLETE = {
    displayName: 'Asha',
    birthday: new Date(1995, 0, 1),
    biologicalSex: 'female',
    bodyWeightKg: 62,
    heightCm: 165,
    goal: 'lose',
    activityLevel: 'moderate',
    sessionsPerWeek: 3,
    trainingEnvironment: 'gym',
};

describe('profile completeness', () => {
    test('a profile with every required answer is complete', () => {
        expect(isProfileComplete(COMPLETE)).toBe(true);
    });

    test('target weight and body type are not required', () => {
        expect(
            isProfileComplete({ ...COMPLETE, targetWeightKg: null, somatotype: null } as never),
        ).toBe(true);
    });

    // The state a skipped onboarding left behind: completedAt set, nothing else.
    test('an empty profile reports every required field as missing', () => {
        expect(missingProfileFields({})).toEqual([
            'displayName',
            'birthday',
            'biologicalSex',
            'bodyWeightKg',
            'heightCm',
            'goal',
            'activityLevel',
            'sessionsPerWeek',
            'trainingEnvironment',
        ]);
    });

    test('a blank name does not count as an answer', () => {
        expect(missingProfileFields({ ...COMPLETE, displayName: '   ' })).toEqual(['displayName']);
    });

    // Zero training days is an answer ("not yet"), not a missing one.
    test('zero sessions a week is answered', () => {
        expect(isProfileComplete({ ...COMPLETE, sessionsPerWeek: 0 })).toBe(true);
    });

    test('NaN from a cleared number field is not an answer', () => {
        expect(missingProfileFields({ ...COMPLETE, bodyWeightKg: Number.NaN })).toEqual([
            'bodyWeightKg',
        ]);
    });
});

describe('age and birthday', () => {
    const NOW = new Date(2026, 9, 9, 12, 0, 0);

    test('round-trips an age through a birthday', () => {
        expect(birthdayToAge(ageToBirthday(30, NOW), NOW.getTime())).toBe(30);
    });

    test('no age gives no birthday, and no birthday gives no age', () => {
        expect(ageToBirthday(null, NOW)).toBeNull();
        expect(birthdayToAge(null, NOW.getTime())).toBeNull();
    });
});
