import { z } from 'zod';

/**
 * The About You answers, as one schema for the two screens that ask them.
 *
 * Onboarding collects these and Settings → Profile edits them, with the same
 * ten fields, the same bounds and the same labels — deliberately, because they
 * are the same questions. They were declared twice and identically, which is
 * one copy too many to keep the messages below in step.
 *
 * Messages are keys, not sentences: `BaseInput` renders a field error as
 * `t(error.message, { ns: 'common' })`. Omitting them is not harmless — zod's
 * own English goes to i18next, which finds no such key and echoes it back, so
 * the screen showed people "Too small: expected number to be >=80".
 *
 * Every field is optional. The assistant produces a better plan with more
 * context, but a blank profile still yields a usable one under
 * general-population assumptions, so nothing here blocks anyone from the app.
 */
export const profileSchema = z.object({
    displayName: z
        .string()
        .trim()
        .max(80, 'errors.profile.displayName.tooLong')
        .optional()
        .nullable(),
    age: z
        .number()
        .int('errors.profile.age.range')
        .min(13, 'errors.profile.age.range')
        .max(100, 'errors.profile.age.range')
        .optional()
        .nullable(),
    biologicalSex: z.enum(['female', 'male', 'other']).optional().nullable(),
    bodyWeightKg: z
        .number()
        .min(20, 'errors.profile.bodyWeightKg.range')
        .max(400, 'errors.profile.bodyWeightKg.range')
        .optional()
        .nullable(),
    heightCm: z
        .number()
        .min(80, 'errors.profile.heightCm.range')
        .max(260, 'errors.profile.heightCm.range')
        .optional()
        .nullable(),
    targetWeightKg: z
        .number()
        .min(20, 'errors.profile.targetWeightKg.range')
        .max(400, 'errors.profile.targetWeightKg.range')
        .optional()
        .nullable(),
    goal: z.enum(['lose', 'maintain', 'gain', 'recomp']).optional().nullable(),
    somatotype: z.enum(['ectomorph', 'mesomorph', 'endomorph']).optional().nullable(),
    activityLevel: z
        .enum(['sedentary', 'light', 'moderate', 'active', 'very_active'])
        .optional()
        .nullable(),
    sessionsPerWeek: z
        .number()
        .int('errors.profile.sessionsPerWeek.range')
        .min(0, 'errors.profile.sessionsPerWeek.range')
        .max(14, 'errors.profile.sessionsPerWeek.range')
        .optional()
        .nullable(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
