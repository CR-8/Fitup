/**
 * "Something was queued" — announced by the change queue, heard by the backup.
 *
 * A module with no imports on purpose. `src/crud/sync` has to be able to say a
 * write happened, and the backup's push already imports `src/crud/sync` to read
 * the queue; going the other way directly would close that loop. A leaf between
 * them lets the signal travel without either side knowing about the other.
 *
 * One listener, not a list: there is exactly one backup running per process, and
 * a set of subscribers would invite the question of what to do when two of them
 * disagree about when to push.
 */

let listener: (() => void) | null = null;

/** Returns the unsubscribe, so the caller's teardown stays symmetrical. */
export const onPendingChange = (handler: () => void): (() => void) => {
    listener = handler;

    return () => {
        if (listener === handler) listener = null;
    };
};

export const notifyPendingChange = (): void => {
    listener?.();
};
