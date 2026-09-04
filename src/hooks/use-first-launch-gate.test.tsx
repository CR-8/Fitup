import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, create } from 'react-test-renderer';

/**
 * The gate decides where someone lands, and it runs on every screen — including
 * the one still finishing an authentication.
 *
 * That collision is the bug these tests exist for. An email link is a cold
 * start: the app opens straight onto `/auth/callback`, signed out, and the gate
 * read that as "not signed in" and replaced the screen with sign-in before
 * `useURL` had delivered the link. The tokens were never exchanged. Tapping a
 * password reset simply returned you to the login page.
 *
 * OAuth hid it, because OAuth is warm — its browser sheet opens inside a running
 * app whose gate has already fired, so the repeat-destination check swallows the
 * second attempt. Arriving from an inbox there is no first attempt to swallow.
 */

const mockReplace = jest.fn();

let mockPathname = '/';
let mockUserId: string | null = 'local-user';
let mockIsSignedIn = false;
let mockIsPrepared = true;
let mockOnboarded = true;
let mockIsLoading = false;
let mockRecoveryPending = false;
let mockUrl: string | null = null;

jest.mock('expo-router', () => ({
    router: { replace: (path: string) => mockReplace(path) },
    usePathname: () => mockPathname,
}));

jest.mock('expo-linking', () => ({ useURL: () => mockUrl }));

jest.mock('@/services/account', () => ({
    isOAuthRedirectUrl: (url: string) => {
        const fragment = new URLSearchParams(url.split('#')[1] ?? '');
        return fragment.has('access_token') || fragment.has('error');
    },
}));

jest.mock('@/hooks/use-user', () => ({
    useUser: () => ({ user: mockUserId ? { id: mockUserId } : null }),
}));

jest.mock('@/hooks/use-account', () => ({
    useAccount: () => ({ isSignedIn: mockIsSignedIn, isPrepared: mockIsPrepared }),
}));

jest.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: mockOnboarded, isLoading: mockIsLoading }),
}));

jest.mock('@/constants/auth', () => ({ isAuthConfigured: () => true }));
jest.mock('@/crud/onboarding', () => ({ hasCompletedOnboarding: async () => mockOnboarded }));
jest.mock('@/services/password-recovery', () => ({
    isPasswordRecoveryPending: () => mockRecoveryPending,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useFirstLaunchGate } = require('@/hooks/use-first-launch-gate');

const Screen = () => {
    useFirstLaunchGate();
    return null;
};

const render = (): void => {
    act(() => {
        create(<Screen />);
    });
};

describe('the first-launch gate', () => {
    beforeEach(() => {
        mockReplace.mockClear();
        mockPathname = '/';
        mockUserId = 'local-user';
        mockIsSignedIn = false;
        mockIsPrepared = true;
        mockOnboarded = true;
        mockIsLoading = false;
        mockRecoveryPending = false;
        mockUrl = null;
    });

    test('a signed-out launch goes to sign-in', () => {
        render();

        expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    });

    test('a signed-in user who has not onboarded goes to About You', () => {
        mockIsSignedIn = true;
        mockOnboarded = false;

        render();

        expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    });

    test('a signed-in, onboarded user is left alone', () => {
        mockIsSignedIn = true;

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });

    /**
     * The regression. Signed out on `/auth/callback` is not someone who needs
     * sending to sign-in — it is someone three hundred milliseconds away from a
     * session, on a screen that redirects itself on success, on failure, and on
     * a timeout if no redirect ever arrives.
     */
    test('a cold start on the auth callback is left to finish', () => {
        mockPathname = '/auth/callback';

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });

    test.each([['/auth/forgot-password'], ['/auth/check-email'], ['/auth/new-password']])(
        'the gate does not evict a signed-out user from %s',
        (pathname) => {
            mockPathname = pathname;

            render();

            expect(mockReplace).not.toHaveBeenCalled();
        },
    );

    /**
     * The window the first fix missed.
     *
     * `App` renders nothing until the user row and the stored session have both
     * resolved, so this hook can run before the router has settled on
     * `/auth/callback`. The pathname is still `/`, which every route-based check
     * reads as an ordinary launch — and the screen holding the tokens is
     * replaced before it has finished mounting.
     */
    test('a redirect in flight is respected even before the router knows the route', () => {
        mockPathname = '/';
        mockUrl = 'fitup://auth/callback#access_token=abc&refresh_token=def&type=recovery';

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('a failed redirect still in flight is left to the callback to report', () => {
        mockPathname = '/';
        mockUrl = 'fitup://auth/callback#error=access_denied&error_code=otp_expired';

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('an unrelated deep link does not hold the gate open', () => {
        // The development client launches on its own URL. Standing down for that
        // would leave a signed-out user sitting wherever they landed.
        mockPathname = '/';
        mockUrl = 'exp+fitup://expo-development-client/?url=http://192.168.1.105:8081';

        render();

        expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    });

    test('a reset link that has already landed is not overruled either', () => {
        // Past the callback, on the new-password screen, and now signed in — the
        // state every rule below reads as an ordinary session.
        mockPathname = '/auth/new-password';
        mockIsSignedIn = true;
        mockRecoveryPending = true;

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('a recovery in progress outranks the gate wherever it is read', () => {
        mockIsSignedIn = true;
        mockOnboarded = false;
        mockRecoveryPending = true;

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('nothing is decided before the local user is prepared', () => {
        mockIsPrepared = false;

        render();

        expect(mockReplace).not.toHaveBeenCalled();
    });
});
