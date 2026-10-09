/**
 * Which About You answers sign-up cannot finish without, and whether a stored
 * profile has them.
 *
 * Kept apart from the onboarding crud so the rule can be tested without a
 * database. It is read in two places that have to agree: the onboarding form,
 * which will not move past a step until these are answered, and the first-launch
 * gate, which sends anyone whose profile is missing one of them back to the form
 * — including accounts created while onboarding could still be skipped.
 *
 * Target weight and body type are the two answers left out on purpose. A target
 * weight means nothing under a "stay in shape" goal, and body type is a rough
 * self-description that plenty of people cannot honestly pick.
 */

export const REQUIRED_PROFILE_FIELDS = [
    'displayName',
    'birthday',
    'biologicalSex',
    'bodyWeightKg',
    'heightCm',
    'goal',
    'activityLevel',
    'sessionsPerWeek',
    'trainingEnvironment',
] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number];

type ProfileLike = { [K in RequiredProfileField]?: unknown };

const isAnswered = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value);

    return true;
};

export const missingProfileFields = (profile: ProfileLike): RequiredProfileField[] =>
    REQUIRED_PROFILE_FIELDS.filter((field) => !isAnswered(profile[field]));

export const isProfileComplete = (profile: ProfileLike): boolean =>
    missingProfileFields(profile).length === 0;

/** Age is friendlier to answer than a date, so it is converted on both sides. */
export const birthdayToAge = (birthday: Date | null, now: number = Date.now()): number | null => {
    if (!birthday) return null;

    const years = (now - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    return years > 0 ? Math.round(years) : null;
};

export const ageToBirthday = (
    age: number | null | undefined,
    now: Date = new Date(),
): Date | null => {
    if (typeof age !== 'number' || !Number.isFinite(age)) return null;

    const birthday = new Date(now);
    birthday.setFullYear(birthday.getFullYear() - Math.round(age));

    return birthday;
};
