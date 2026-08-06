export const FITUP_EXERCISES_USER_ID = '__fitup__';

export const isFitupExerciseUserId = (userId: string | null | undefined): boolean =>
    userId === FITUP_EXERCISES_USER_ID;

// Object storage bucket holding the bundled exercise animations. This bucket is
// Fitup-owned and must exist before exercise GIFs will render — set
// EXPO_PUBLIC_EXERCISE_GIF_BASE_URL to override it without touching this file.
const DEFAULT_EXERCISE_GIF_BASE_URL =
    'https://storage.yandexcloud.net/fitup-storage/images/exercises';
const EXERCISE_GIF_BASE_URL =
    process.env.EXPO_PUBLIC_EXERCISE_GIF_BASE_URL || DEFAULT_EXERCISE_GIF_BASE_URL;

export const EXERCISE_GIF_THUMBNAIL_RESOLUTION = 180;
export const EXERCISE_GIF_PREVIEW_RESOLUTION = 1080;

export const buildExerciseGifUrl = (gifFilename: string, resolution: number): string => {
    const normalizedFilename = gifFilename.trim();
    if (!normalizedFilename) return '';

    const normalizedBaseUrl = EXERCISE_GIF_BASE_URL.replace(/\/+$/, '');
    return `${normalizedBaseUrl}/${encodeURIComponent(normalizedFilename)}-${resolution}.gif`;
};
