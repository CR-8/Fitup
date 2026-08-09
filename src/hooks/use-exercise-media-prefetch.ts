import { useEffect } from 'react';

import { prefetchExerciseMedia } from '@/services/exercise-media';
import { runInBackground } from '@/services/error-reporting';

/**
 * Warms the animation cache for a set of exercises.
 *
 * Mounted where a workout's exercises become known — opening a workout, or
 * starting one — so the media is on disk before the user reaches the exercise
 * that needs it.
 */
export const useExerciseMediaPrefetch = (gifFilenames: (string | null | undefined)[]): void => {
    // Joined so the effect re-runs on content change rather than array identity,
    // which would refire on every render.
    const key = gifFilenames.filter(Boolean).join('|');

    useEffect(() => {
        if (!key) return;

        runInBackground(
            () => prefetchExerciseMedia(key.split('|')),
            'Failed to prefetch exercise media:',
        );
    }, [key]);
};
