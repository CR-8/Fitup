import type { UserSelect } from '@/db/schema';

/**
 * What a typical adult looks like, used as placeholder text.
 *
 * These are hints and nothing more. They are never written: onboarding stores
 * body weight and height as `measurement` rows, which are a time series, so a
 * number nobody typed would appear on the weight chart as a real weigh-in.
 *
 * Height is the NCD Risk Factor Collaboration's global mean adult height. Weight
 * is *derived* from that height and NCD-RisC's global mean adult BMI rather than
 * lifted from a separate survey, because two figures from two sources can imply
 * a BMI that belongs to neither — and a height and weight shown together have to
 * make sense together.
 */

/** Global mean adult BMI (NCD-RisC). */
const MEAN_BMI = { male: 24.5, female: 24.8 } as const;

/** Global mean adult height in centimetres (NCD-RisC). */
const MEAN_HEIGHT_CM = { male: 171, female: 159 } as const;

const weightForBmi = (heightCm: number, bmi: number): number =>
    Math.round(bmi * (heightCm / 100) ** 2);

/** The UN's global median age, rounded. */
export const MEDIAN_AGE_YEARS = 30;

/**
 * Not an average — the WHO's 150 minutes of moderate activity a week, expressed
 * as sessions someone might actually plan. Global participation is well below
 * this; it is here as a starting point, not a description of the world.
 */
export const GUIDELINE_SESSIONS_PER_WEEK = 3;

export interface BodyAverages {
    heightCm: number;
    bodyWeightKg: number;
}

const MALE: BodyAverages = {
    heightCm: MEAN_HEIGHT_CM.male,
    bodyWeightKg: weightForBmi(MEAN_HEIGHT_CM.male, MEAN_BMI.male),
};

const FEMALE: BodyAverages = {
    heightCm: MEAN_HEIGHT_CM.female,
    bodyWeightKg: weightForBmi(MEAN_HEIGHT_CM.female, MEAN_BMI.female),
};

/**
 * Used before the question is answered, and for anyone who answers "other".
 * Midway between the two rather than a third statistic, so the three sets stay
 * derived from the same two numbers.
 */
const COMBINED_HEIGHT_CM = (MEAN_HEIGHT_CM.male + MEAN_HEIGHT_CM.female) / 2;
const COMBINED_BMI = (MEAN_BMI.male + MEAN_BMI.female) / 2;

const COMBINED: BodyAverages = {
    heightCm: Math.round(COMBINED_HEIGHT_CM),
    bodyWeightKg: weightForBmi(COMBINED_HEIGHT_CM, COMBINED_BMI),
};

/**
 * The pair to show while the body questions are still blank.
 *
 * Re-read whenever the answer to "biological sex" changes. Nothing has to guard
 * against overwriting what someone typed, because a placeholder is only visible
 * while the field is empty.
 */
export const worldAverages = (
    biologicalSex: UserSelect['biologicalSex'] | undefined,
): BodyAverages => {
    if (biologicalSex === 'male') return MALE;
    if (biologicalSex === 'female') return FEMALE;

    return COMBINED;
};
