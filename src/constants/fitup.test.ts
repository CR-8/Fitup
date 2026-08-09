import { afterEach, describe, expect, jest, test } from '@jest/globals';

const ENV_KEYS = [
    'EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL',
    'EXPO_PUBLIC_EXERCISE_GIF_BASE_URL',
] as const;

const loadModule = (env: Partial<Record<(typeof ENV_KEYS)[number], string>>) => {
    jest.resetModules();

    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(env)) process.env[key] = value;

    // Re-required after resetting the registry so each case sees its own env.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./fitup') as typeof import('./fitup');
};

afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
});

describe('exercise media resolution', () => {
    test('reports media as unconfigured when no host is set', () => {
        const { isExerciseMediaConfigured, buildExerciseGifUrl } = loadModule({});

        expect(isExerciseMediaConfigured()).toBe(false);
        // Callers treat an empty string as "no animation" and render text only.
        expect(buildExerciseGifUrl('0001-2gPfomN')).toBe('');
    });

    test('builds a dataset-style url from the media basename', () => {
        const { buildExerciseGifUrl } = loadModule({
            EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL: 'https://media.example.test/exercises',
        });

        expect(buildExerciseGifUrl('0001-2gPfomN')).toBe(
            'https://media.example.test/exercises/0001-2gPfomN.gif',
        );
    });

    test('does not duplicate a trailing slash on the base url', () => {
        const { buildExerciseGifUrl } = loadModule({
            EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL: 'https://media.example.test/exercises/',
        });

        expect(buildExerciseGifUrl('0001-2gPfomN')).toBe(
            'https://media.example.test/exercises/0001-2gPfomN.gif',
        );
    });

    test('falls back to the previous variable name so existing deployments keep working', () => {
        const { buildExerciseGifUrl, isExerciseMediaConfigured } = loadModule({
            EXPO_PUBLIC_EXERCISE_GIF_BASE_URL: 'https://legacy.example.test/gifs',
        });

        expect(isExerciseMediaConfigured()).toBe(true);
        expect(buildExerciseGifUrl('0001-2gPfomN')).toBe(
            'https://legacy.example.test/gifs/0001-2gPfomN.gif',
        );
    });

    test('ignores the resolution argument, since the licence caps media at 180x180', () => {
        const { buildExerciseGifUrl } = loadModule({
            EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL: 'https://media.example.test',
        });

        expect(buildExerciseGifUrl('0001-2gPfomN', 1080)).toBe(
            buildExerciseGifUrl('0001-2gPfomN', 180),
        );
    });

    test('returns empty for a blank filename', () => {
        const { buildExerciseGifUrl } = loadModule({
            EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL: 'https://media.example.test',
        });

        expect(buildExerciseGifUrl('   ')).toBe('');
    });

    test('escapes a filename so it cannot break out of the path', () => {
        const { buildExerciseGifUrl } = loadModule({
            EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL: 'https://media.example.test',
        });

        expect(buildExerciseGifUrl('../../etc/passwd')).toBe(
            'https://media.example.test/..%2F..%2Fetc%2Fpasswd.gif',
        );
    });
});

describe('system exercise ownership', () => {
    test('recognises the reserved catalogue user id', () => {
        const { FITUP_EXERCISES_USER_ID, isFitupExerciseUserId } = loadModule({});

        expect(isFitupExerciseUserId(FITUP_EXERCISES_USER_ID)).toBe(true);
        expect(isFitupExerciseUserId('someUserId')).toBe(false);
        expect(isFitupExerciseUserId(null)).toBe(false);
        expect(isFitupExerciseUserId(undefined)).toBe(false);
    });
});
