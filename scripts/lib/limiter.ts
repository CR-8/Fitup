/**
 * Rate limiting and concurrency for the seed run.
 *
 * These are two separate concerns and conflating them is the usual mistake.
 * The bucket caps the *rate* — how often a request may start. The pool caps
 * *concurrency* — how many may be in flight. Running four workers against a
 * one-per-second bucket does not upload four per second; it means a slow
 * response never leaves the bucket idle while its token goes unused.
 */

/**
 * A token bucket holding a single token, refilled on a fixed interval.
 *
 * Deliberately not a burst bucket: the point is a hard floor on the gap between
 * two requests, so an upstream limit of "60 per minute" is never tripped by 60
 * requests arriving in the first second of that minute.
 */
export const createRateLimiter = (intervalMs: number) => {
    let nextAvailable = 0;

    return async (): Promise<void> => {
        const now = Date.now();
        // Reserve this caller's slot before awaiting, so concurrent callers each
        // take a distinct one instead of all reading the same `now` and racing.
        const scheduled = Math.max(now, nextAvailable);
        nextAvailable = scheduled + intervalMs;

        const wait = scheduled - now;
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    };
};

/**
 * Runs `task` over `items` with at most `concurrency` in flight.
 *
 * Workers pull from a shared cursor rather than the list being sliced up front,
 * so one slow item does not stall a whole partition, and `Promise.all` is never
 * handed 1,324 promises that would all try to start at once.
 */
export const runPool = async <T, R>(
    items: T[],
    concurrency: number,
    task: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
        for (;;) {
            const index = cursor++;
            if (index >= items.length) return;

            results[index] = await task(items[index], index);
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
    );

    return results;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface RetryOptions {
    attempts: number;
    baseDelayMs: number;
    /** Whether a failure is worth another attempt. */
    isRetryable: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Exponential backoff around a single operation.
 *
 * Rethrows immediately for anything `isRetryable` rejects — a 404 or a bad
 * signature will fail identically on the fourth attempt, and burning three more
 * seconds per record across 1,324 records turns a bad run into a very long one.
 */
export const withRetry = async <T>(
    operation: () => Promise<T>,
    { attempts, baseDelayMs, isRetryable, onRetry }: RetryOptions,
): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt === attempts || !isRetryable(error)) break;

            const delayMs = baseDelayMs * 2 ** (attempt - 1);
            onRetry?.(error, attempt, delayMs);
            await sleep(delayMs);
        }
    }

    throw lastError;
};
