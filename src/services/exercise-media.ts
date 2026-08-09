import { Image as ExpoImage } from 'expo-image';

import { buildExerciseGifUrl, isExerciseMediaConfigured } from '@/constants/fitup';
import { reportError } from '@/services/error-reporting';

/**
 * Exercise animation prefetching.
 *
 * `expo-image` keeps a disk cache, so an animation viewed once stays available
 * offline afterwards. Prefetching the handful of exercises in an upcoming
 * workout turns that into deliberate behaviour: by the time the session starts,
 * its media is already local.
 *
 * A workout has a few exercises, not the whole catalogue, so this is a small
 * download rather than a bulk sync.
 */

/** Requests issued at once, to avoid saturating a phone connection. */
const CONCURRENCY = 4;

const inFlight = new Set<string>();

const chunk = <T>(values: T[], size: number): T[][] => {
    const batches: T[][] = [];

    for (let index = 0; index < values.length; index += size) {
        batches.push(values.slice(index, index + size));
    }

    return batches;
};

/**
 * Warms the cache for the given media basenames.
 *
 * Never throws and never blocks anything the user is waiting on: a failed
 * prefetch simply means the animation is fetched on demand later, and a missing
 * animation is not an error state anywhere in the app.
 */
export const prefetchExerciseMedia = async (gifFilenames: (string | null | undefined)[]) => {
    if (!isExerciseMediaConfigured()) return;

    const urls = Array.from(
        new Set(
            gifFilenames
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
                .map((name) => buildExerciseGifUrl(name))
                .filter((url) => url.length > 0 && !inFlight.has(url)),
        ),
    );

    if (urls.length === 0) return;

    for (const url of urls) inFlight.add(url);

    try {
        for (const batch of chunk(urls, CONCURRENCY)) {
            await Promise.all(
                batch.map((url) =>
                    ExpoImage.prefetch(url, { cachePolicy: 'disk' }).catch(() => false),
                ),
            );
        }
    } catch (error) {
        reportError(error, 'Failed to prefetch exercise media');
    } finally {
        for (const url of urls) inFlight.delete(url);
    }
};

/** Clears cached animations. Offered so storage can be reclaimed from settings. */
export const clearExerciseMediaCache = async (): Promise<void> => {
    try {
        await ExpoImage.clearDiskCache();
    } catch (error) {
        reportError(error, 'Failed to clear the exercise media cache');
    }
};
