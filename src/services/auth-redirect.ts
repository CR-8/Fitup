/**
 * The auth redirect, held where it is guaranteed to have been heard.
 *
 * `useURL()` reports two things: the URL the app was launched with, and any
 * that arrive while the calling component is mounted. Neither covers the case
 * that matters here.
 *
 * A redirect into a running app arrives as an event, and that event is what
 * navigates to `/auth/callback`. The screen therefore mounts *because* the URL
 * arrived — after the event has been delivered. Subscribing then is too late,
 * and `getInitialURL()` answers with the URL that started the app, which is the
 * launcher's, not the redirect. So the screen holding the tokens came up with
 * `url: null`, waited out its timeout and bounced to sign-in, while the root —
 * mounted all along — had the tokens the whole time.
 *
 * OAuth hid this too: `signInWithGoogle` receives the redirect as the return
 * value of `openAuthSessionAsync` and exchanges it itself, so the callback
 * screen is only ever its backup and its silence went unnoticed.
 *
 * Module scope, not context, because the value has to be readable on the first
 * render of a screen that did not exist when it arrived.
 */

type Listener = (url: string) => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

/** Called from the root, which is mounted before any redirect can arrive. */
export const noteAuthRedirect = (url: string): void => {
    if (pending === url) return;

    pending = url;

    // Copied first: a listener that unsubscribes on delivery would otherwise
    // mutate the set being iterated.
    for (const listener of [...listeners]) listener(url);
};

/** What is waiting, for a screen that mounted after it arrived. */
export const peekAuthRedirect = (): string | null => pending;

/**
 * Dropped once a screen has taken responsibility for it. A redirect left here
 * would be replayed on the next mount, against a token that is single-use —
 * which fails as "link expired" and reads exactly like a broken link.
 */
export const clearAuthRedirect = (): void => {
    pending = null;
};

export const subscribeToAuthRedirect = (listener: Listener): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};
