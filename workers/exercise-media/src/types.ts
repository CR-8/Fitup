export interface Env {
    DB: D1Database;
    API_RATE_LIMITER: RateLimit;
}

/** The five locales the app ships. Anything else is rejected before it reaches SQL. */
export const LOCALES = ['en', 'es', 'hi', 'ru', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (value: string): value is Locale =>
    (LOCALES as readonly string[]).includes(value);

export interface ExerciseItem {
    id: string;
    name: string;
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
