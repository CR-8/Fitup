export interface Env {
    DB: D1Database;
    API_RATE_LIMITER: RateLimit;
}

/**
 * Locales this API accepts. Anything else is rejected before it reaches SQL.
 *
 * Wider than the two the app now ships, deliberately. Spanish, Russian and
 * Chinese instructions have been deleted from D1, but builds released before
 * that still ask for them — and an unlisted locale is a 400, which would break
 * their catalogue sync outright. Listed, they fall through the LEFT JOIN in
 * `db.ts` to English, which is the degradation we want.
 */
export const LOCALES = ['en', 'es', 'hi', 'ru', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (value: string): value is Locale =>
    (LOCALES as readonly string[]).includes(value);

export interface ExerciseItem {
    id: string;
    /** Localised where a translation exists, English otherwise. */
    name: string;
    /** Always English, so a client can keep searching in both scripts. */
    nameEn: string;
    category: string;
    equipment: string[];
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    gifFilename: string;
    secureUrl: string;
    width: number;
    height: number;
    instructions: string[];
}

export interface Page {
    items: ExerciseItem[];
    nextCursor: string | null;
    hasMore: boolean;
}
