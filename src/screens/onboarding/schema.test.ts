import { describe, expect, test } from '@jest/globals';

import { profileSchema } from './schema';

/**
 * Sign-up cannot finish with a required answer blank — and a blank must come
 * back as a translation key, not zod's English, because `BaseInput` renders
 * `t(error.message)`.
 */

const COMPLETE = {
    displayName: 'Asha',
    age: 29,
    biologicalSex: 'female',
    bodyWeightKg: 62,
    heightCm: 165,
    targetWeightKg: null,
    goal: 'lose',
    somatotype: null,
    activityLevel: 'moderate',
    sessionsPerWeek: 3,
    trainingEnvironment: 'gym',
};

const messagesFor = (values: Record<string, unknown>) => {
    const result = profileSchema.safeParse(values);

    return result.success
        ? {}
        : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
};

describe('the About You answers', () => {
    test('a complete profile passes with target weight and body type left blank', () => {
        expect(profileSchema.safeParse(COMPLETE).success).toBe(true);
    });

    test('every required answer left blank is reported, as a translation key', () => {
        const blank = Object.fromEntries(Object.keys(COMPLETE).map((key) => [key, null]));

        expect(messagesFor(blank)).toEqual({
            displayName: 'errors.profile.displayName.required',
            age: 'errors.profile.required',
            biologicalSex: 'errors.profile.required',
            bodyWeightKg: 'errors.profile.required',
            heightCm: 'errors.profile.required',
            goal: 'errors.profile.required',
            activityLevel: 'errors.profile.required',
            sessionsPerWeek: 'errors.profile.required',
            trainingEnvironment: 'errors.profile.required',
        });
    });

    test('a name of only spaces is blank', () => {
        expect(messagesFor({ ...COMPLETE, displayName: '   ' })).toEqual({
            displayName: 'errors.profile.displayName.required',
        });
    });

    test('range checks still apply to answers that are given', () => {
        expect(messagesFor({ ...COMPLETE, age: 5 })).toEqual({ age: 'errors.profile.age.range' });
    });
});
