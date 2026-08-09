import { updateUser } from '@/crud/user';
import { createMeasurements } from '@/crud/measurement';
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

export const hasCompletedOnboarding = async (userId: string): Promise<boolean> => {
    const profile = await getProfile(userId);
    return profile?.completedAt != null;
};

/** Records that onboarding was dismissed, so it is not shown again. */
export const skipOnboarding = async (userId: string): Promise<void> => {
    await upsertProfile(userId, { completedAt: new Date() });
};
