import { getCurrentUser, updateUser } from '@/crud/user';
import { createMeasurements, getLatestMeasurementsByMetric } from '@/crud/measurement';
import { getProfile, upsertProfile } from '@/crud/ai';
import type { AiProfileSelect, UserSelect } from '@/db/schema';

/**
 * Persists the onboarding answers.
 *
 * The answers deliberately land in three different places rather than a single
 * onboarding table:
 *
 *   - identity (name, birthday, sex) on `user`
 *   - training and diet preferences on `ai_profile`
 *   - body weight and height as `measurement` rows
 *
 * The last one matters: weight and height are time series, not settings. Writing
 * them as measurements means the first onboarding answer is already the first
 * point on the user's charts, and health-platform imports extend the same series
 * instead of competing with a duplicate copy.
 */

export type Somatotype = NonNullable<AiProfileSelect['somatotype']>;
export type Goal = NonNullable<AiProfileSelect['goal']>;
export type ActivityLevel = NonNullable<AiProfileSelect['activityLevel']>;
export type BiologicalSex = NonNullable<UserSelect['biologicalSex']>;

export interface OnboardingAnswers {
    displayName?: string | null;
    birthday?: Date | null;
    biologicalSex?: BiologicalSex | null;
    /** Always stored in kilograms; the interface converts for display. */
    bodyWeightKg?: number | null;
    heightCm?: number | null;
    targetWeightKg?: number | null;
    goal?: Goal | null;
    somatotype?: Somatotype | null;
    activityLevel?: ActivityLevel | null;
    sessionsPerWeek?: number | null;
    sessionMinutes?: number | null;
}

const isPositive = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

export const saveOnboardingAnswers = async (
    userId: string,
    answers: OnboardingAnswers,
): Promise<void> => {
    const trimmedName = answers.displayName?.trim();

    await updateUser(userId, {
        displayName: trimmedName?.length ? trimmedName : null,
        birthday: answers.birthday ?? null,
        biologicalSex: answers.biologicalSex ?? null,
    });

    await upsertProfile(userId, {
        goal: answers.goal ?? null,
        somatotype: answers.somatotype ?? null,
        activityLevel: answers.activityLevel ?? null,
        sessionsPerWeek: answers.sessionsPerWeek ?? null,
        sessionMinutes: answers.sessionMinutes ?? null,
        targetWeightKg: answers.targetWeightKg ?? null,
        completedAt: new Date(),
    });

    const recordedAt = new Date();
    const measurements = [];

    if (isPositive(answers.bodyWeightKg)) {
        measurements.push({
            metric: 'body_weight',
            value: answers.bodyWeightKg,
            unit: 'kg',
            recordedAt,
        });
    }

    if (isPositive(answers.heightCm)) {
        measurements.push({
            metric: 'height',
            value: answers.heightCm,
            unit: 'cm',
            recordedAt,
        });
    }

    if (measurements.length > 0) {
        await createMeasurements(measurements, userId);
    }
};

/**
 * The same answers, read back and written from Settings.
 *
 * Deliberately not `saveOnboardingAnswers`. That one stamps `completedAt` on
 * every call, which is right once — it is what marks onboarding as answered —
 * and wrong on an edit, where it would keep moving the date the user finished
 * onboarding forward to today.
 */
export interface ProfileDetails {
    displayName: string | null;
    birthday: Date | null;
    biologicalSex: BiologicalSex | null;
    bodyWeightKg: number | null;
    heightCm: number | null;
    targetWeightKg: number | null;
    goal: Goal | null;
    somatotype: Somatotype | null;
    activityLevel: ActivityLevel | null;
    sessionsPerWeek: number | null;
}

export const readProfileDetails = async (userId: string): Promise<ProfileDetails> => {
    const [user, profile, latest] = await Promise.all([
        getCurrentUser(),
        getProfile(userId),
        getLatestMeasurementsByMetric(['body_weight', 'height'], userId),
    ]);

    return {
        displayName: user?.displayName ?? null,
        birthday: user?.birthday ?? null,
        biologicalSex: user?.biologicalSex ?? null,
        bodyWeightKg: latest.body_weight?.value ?? null,
        heightCm: latest.height?.value ?? null,
        targetWeightKg: profile?.targetWeightKg ?? null,
        goal: profile?.goal ?? null,
        somatotype: profile?.somatotype ?? null,
        activityLevel: profile?.activityLevel ?? null,
        sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    };
};

export const saveProfileDetails = async (
    userId: string,
    details: ProfileDetails,
): Promise<void> => {
    const trimmedName = details.displayName?.trim();

    await updateUser(userId, {
        displayName: trimmedName?.length ? trimmedName : null,
        birthday: details.birthday ?? null,
        biologicalSex: details.biologicalSex ?? null,
    });

    await upsertProfile(userId, {
        goal: details.goal ?? null,
        somatotype: details.somatotype ?? null,
        activityLevel: details.activityLevel ?? null,
        sessionsPerWeek: details.sessionsPerWeek ?? null,
        targetWeightKg: details.targetWeightKg ?? null,
    });

    // Weight and height are a time series, so an edit appends a point rather
    // than replacing one — and an unchanged value appends nothing, or opening
    // this screen and pressing Save would flatten the chart with duplicates.
    const latest = await getLatestMeasurementsByMetric(['body_weight', 'height'], userId);
    const recordedAt = new Date();
    const measurements = [];

    if (isPositive(details.bodyWeightKg) && latest.body_weight?.value !== details.bodyWeightKg) {
        measurements.push({
            metric: 'body_weight',
            value: details.bodyWeightKg,
            unit: 'kg',
            recordedAt,
        });
    }

    if (isPositive(details.heightCm) && latest.height?.value !== details.heightCm) {
        measurements.push({
            metric: 'height',
            value: details.heightCm,
            unit: 'cm',
            recordedAt,
        });
    }

    if (measurements.length > 0) {
        await createMeasurements(measurements, userId);
    }
};

export const hasCompletedOnboarding = async (userId: string): Promise<boolean> => {
    const profile = await getProfile(userId);
    return profile?.completedAt != null;
};

/** Records that onboarding was dismissed, so it is not shown again. */
export const skipOnboarding = async (userId: string): Promise<void> => {
    await upsertProfile(userId, { completedAt: new Date() });
};
