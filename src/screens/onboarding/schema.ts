import { z } from 'zod';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * The About You answers, as one schema for the two screens that ask them.
 *
 * Onboarding collects these and Settings → Profile edits them, with the same
 * fields, the same bounds and the same labels — deliberately, because they are
 * the same questions. They were declared twice and identically, which is one
 * copy too many to keep the messages below in step.
 *
 * Messages are keys, not sentences: `BaseInput` renders a field error as
 * `t(error.message, { ns: 'common' })`. Omitting them is not harmless — zod's
 * own English goes to i18next, which finds no such key and echoes it back, so
 * the screen showed people "Too small: expected number to be >=80". That is
 * also why every required field passes `error`: a field left blank arrives as
 * `null`, and zod's invalid-type message for it would be English too.
 *
 * Sign-up cannot be finished without the required answers — see
 * `REQUIRED_PROFILE_FIELDS` in src/helpers/profile.ts, which the first-launch
 * gate checks against the stored profile. Target weight and body type stay
 * optional, for the reasons given there.
 */
const REQUIRED = 'errors.profile.required';

export const profileSchema = z.object({
    displayName: z
        .string({ error: 'errors.profile.displayName.required' })
        .trim()
        .min(1, 'errors.profile.displayName.required')
        .max(80, 'errors.profile.displayName.tooLong'),
    age: z
        .number({ error: REQUIRED })
        .int('errors.profile.age.range')
        .min(13, 'errors.profile.age.range')
        .max(100, 'errors.profile.age.range'),
    biologicalSex: z.enum(['female', 'male', 'other'], { error: REQUIRED }),
    bodyWeightKg: z
        .number({ error: REQUIRED })
        .min(20, 'errors.profile.bodyWeightKg.range')
        .max(400, 'errors.profile.bodyWeightKg.range'),
    heightCm: z
        .number({ error: REQUIRED })
        .min(80, 'errors.profile.heightCm.range')
        .max(260, 'errors.profile.heightCm.range'),
    targetWeightKg: z
        .number()
        .min(20, 'errors.profile.targetWeightKg.range')
        .max(400, 'errors.profile.targetWeightKg.range')
        .optional()
        .nullable(),
    goal: z.enum(['lose', 'maintain', 'gain', 'recomp'], { error: REQUIRED }),
    somatotype: z.enum(['ectomorph', 'mesomorph', 'endomorph']).optional().nullable(),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active'], {
        error: REQUIRED,
    }),
    sessionsPerWeek: z
        .number({ error: REQUIRED })
        .int('errors.profile.sessionsPerWeek.range')
        .min(0, 'errors.profile.sessionsPerWeek.range')
        .max(14, 'errors.profile.sessionsPerWeek.range'),
    /** Where the assistant should assume plans are trained — see ai_profile.trainingEnvironment. */
    trainingEnvironment: z.enum(['home', 'gym'], { error: REQUIRED }),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * What the form holds while it is being filled in: every answer may still be
 * blank. `ProfileFormData` is what comes out once the schema has passed it.
 */
export type ProfileFormValues = {
    [K in keyof ProfileFormData]: ProfileFormData[K] | null;
};

/**
 * The resolver both forms use.
 *
 * Typed by hand because `zodResolver` takes the form's values to be the
 * schema's input, which has no blanks — but a blank is exactly what the form
 * holds until a question is answered, and turning it into the "required"
 * message is this schema's job.
 */
export const profileResolver = zodResolver(profileSchema) as unknown as Resolver<
    ProfileFormValues,
    unknown,
    ProfileFormData
>;
