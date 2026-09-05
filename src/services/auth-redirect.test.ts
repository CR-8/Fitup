import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
    clearAuthRedirect,
    noteAuthRedirect,
    peekAuthRedirect,
    subscribeToAuthRedirect,
} from '@/services/auth-redirect';

/**
 * The ordering this exists for is the one that broke: the redirect arrives, and
 * *because* it arrived the app navigates to the screen that handles it. That
 * screen therefore mounts after the fact. Anything that only listens forward —
 * which is all `useURL` offers a late mounter — hears nothing at all, and the
 * tokens go unused while the screen times out.
 */

const REDIRECT = 'fitup://auth/callback#access_token=abc&refresh_token=def&type=recovery';

describe('the captured auth redirect', () => {
    beforeEach(clearAuthRedirect);

    test('nothing is waiting until something arrives', () => {
        expect(peekAuthRedirect()).toBeNull();
    });

    // The regression, stated as plainly as it can be.
    test('a redirect that arrived before the reader existed is still there', () => {
        noteAuthRedirect(REDIRECT);

        expect(peekAuthRedirect()).toBe(REDIRECT);
    });

    test('a reader already listening is told', () => {
        const heard = jest.fn();
        subscribeToAuthRedirect(heard);

        noteAuthRedirect(REDIRECT);

        expect(heard).toHaveBeenCalledWith(REDIRECT);
    });

    test('the same redirect is not announced twice', () => {
        const heard = jest.fn();
        subscribeToAuthRedirect(heard);

        noteAuthRedirect(REDIRECT);
        noteAuthRedirect(REDIRECT);

        expect(heard).toHaveBeenCalledTimes(1);
    });

    test('unsubscribing stops delivery', () => {
        const heard = jest.fn();
        const stop = subscribeToAuthRedirect(heard);

        stop();
        noteAuthRedirect(REDIRECT);

        expect(heard).not.toHaveBeenCalled();
    });

    test('a listener that unsubscribes on delivery does not break the rest', () => {
        const second = jest.fn();
        const stop = subscribeToAuthRedirect(() => stop());
        subscribeToAuthRedirect(second);

        expect(() => noteAuthRedirect(REDIRECT)).not.toThrow();
        expect(second).toHaveBeenCalledWith(REDIRECT);
    });

    /**
     * Recovery tokens are single-use. A redirect left in the store is replayed
     * by the next mount, fails as "link expired", and looks precisely like a
     * link that never worked — the failure this whole thread has been chasing.
     */
    test('what has been taken is not offered again', () => {
        noteAuthRedirect(REDIRECT);
        clearAuthRedirect();

        expect(peekAuthRedirect()).toBeNull();
    });

    test('a later redirect replaces one already taken', () => {
        noteAuthRedirect(REDIRECT);
        clearAuthRedirect();

        const next = 'fitup://auth/callback#access_token=ghi&type=signup';
        noteAuthRedirect(next);

        expect(peekAuthRedirect()).toBe(next);
    });
});
