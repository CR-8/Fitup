export const FITUP_EXERCISES_USER_ID = '__fitup__';

export const isFitupExerciseUserId = (userId: string | null | undefined): boolean =>
    userId === FITUP_EXERCISES_USER_ID;

/**
 * Where exercise animations are served from.
 *
 * The bundled catalogue is built from the open exercises-dataset, whose media is
 * © Gym visual and is NOT redistributable — that repository's own NOTICE states
 * that cloning it grants no rights to the media. So no media ships with this app.
 *
 * To show animations, obtain your own rights from Gym visual, host the files
 * yourself, and point EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL at the directory that
 * contains them. Left empty, the app degrades to text instructions, which are
 * MIT licensed and do ship.
 */
const EXERCISE_MEDIA_BASE_URL = (
    process.env.EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL ??
    // Retained so an existing deployment keeps working after the rename.
    process.env.EXPO_PUBLIC_EXERCISE_GIF_BASE_URL ??
    ''
).trim();

/**
 * The upstream media is licensed at 180x180 only, so thumbnail and preview
 * resolve to the same asset. These remain distinct so callers can keep
 * expressing intent, and so a higher-resolution source can be introduced later
 * without touching call sites.
 */
export const EXERCISE_GIF_THUMBNAIL_RESOLUTION = 180;
export const EXERCISE_GIF_PREVIEW_RESOLUTION = 180;

/** Attribution the media licence requires to be displayed wherever it is shown. */
export const EXERCISE_MEDIA_ATTRIBUTION = '© Gym visual — gymvisual.com';

export const isExerciseMediaConfigured = (): boolean => EXERCISE_MEDIA_BASE_URL.length > 0;

/**
 * Resolves a media URL for a catalogue entry.
 *
 * `gifFilename` is the dataset basename, e.g. `0001-2gPfomN`. Returns an empty
 * string when no host is configured, which callers treat as "no animation".
 */
export const buildExerciseGifUrl = (gifFilename: string, _resolution?: number): string => {
    const normalizedFilename = gifFilename.trim();
    if (!normalizedFilename || !EXERCISE_MEDIA_BASE_URL) return '';

    const normalizedBaseUrl = EXERCISE_MEDIA_BASE_URL.replace(/\/+$/, '');
    return `${normalizedBaseUrl}/${encodeURIComponent(normalizedFilename)}.gif`;
};
