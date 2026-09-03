import { describe, expect, jest, test } from '@jest/globals';
import {
    AuthError,
    claimOAuthNavigation,
    completeOAuthRedirect,
    isOAuthRedirectUrl,
    signInWithGoogle,
    signOut,
} from '@/services/account';
import { clearAuthSession } from '@/services/auth';

/**
 * Guards the question "is this URL the OAuth callback?".
 *
 * Getting it wrong is not a loud failure: the app receives unrelated links all the
 * time — the development client launches on one — and a screen that accepts the first
 * of them reports a broken sign-in against a URL that never carried a result.
 */

jest.mock('@/services/supabase', () => ({
    supabase: null,
    requireSupabase: () => {
        throw new Error('Supabase is not configured for this build');
    },
}));

jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));

jest.mock('@/services/auth', () => ({ clearAuthSession: jest.fn() }));

// Only what these tests actually reach for. Mirroring the whole of AUTH_CONFIG here
// would just rot quietly as the real one grows.
jest.mock('@/constants/auth', () => ({
    AUTH_CONFIG: { googleEnabled: true },
    isAuthConfigured: () => true,
}));

describe('claimOAuthNavigation', () => {
    // The claim is module state by design — it has to outlive both screens that race
    // for it — so each test opens its own attempt rather than assuming a clean slate.
    // Supabase is mocked as absent, so the call always rejects; the reset it performs
    // first is the part under test.
    const startAttempt = async (): Promise<void> => {
        await expect(signInWithGoogle()).rejects.toThrow();
    };

    test('only the first caller may navigate', async () => {
        await startAttempt();

        // Both the callback route and the sign-in screen reach this point after a
        // successful exchange; letting both through means two router.replace calls.
        expect(claimOAuthNavigation()).toBe(true);
        expect(claimOAuthNavigation()).toBe(false);
        expect(claimOAuthNavigation()).toBe(false);
    });

    test('a new sign-in attempt reopens the claim', async () => {
        await startAttempt();
        expect(claimOAuthNavigation()).toBe(true);
        expect(claimOAuthNavigation()).toBe(false);

        // Without this reset a second sign-in would exchange tokens successfully and
        // then leave the user sitting on the sign-in screen.
        await startAttempt();
        expect(claimOAuthNavigation()).toBe(true);
    });
});

describe('isOAuthRedirectUrl', () => {
    test('accepts a successful provider redirect', () => {
        expect(isOAuthRedirectUrl('fitup://auth/callback#access_token=abc&refresh_token=def')).toBe(
            true,
        );
    });

    test('accepts a redirect that reports failure', () => {
        expect(
            isOAuthRedirectUrl('fitup://auth/callback#error=access_denied&error_description=no'),
        ).toBe(true);
    });

    test('rejects the development client launch URL', () => {
        // The exact shape that made the screen fail the sign-in before the real
        // redirect had a chance to arrive.
        expect(
            isOAuthRedirectUrl('exp+fitup://expo-development-client/?url=http://192.168.1.6:8081'),
        ).toBe(false);
    });

    test('rejects the bare callback path with no result', () => {
        expect(isOAuthRedirectUrl('fitup://auth/callback')).toBe(false);
    });

    test('does not mistake a query string for the result fragment', () => {
        expect(isOAuthRedirectUrl('fitup://auth/callback?access_token=abc')).toBe(false);
    });
});

describe('completeOAuthRedirect', () => {
    test('reports a denied consent screen as cancelled', async () => {
        await expect(
            completeOAuthRedirect('fitup://auth/callback#error=access_denied'),
        ).rejects.toMatchObject({ code: 'CANCELLED' });
    });

    test('reports other provider errors as failures', async () => {
        await expect(
            completeOAuthRedirect('fitup://auth/callback#error=server_error'),
        ).rejects.toMatchObject({ code: 'UNKNOWN' });
    });

    test('rejects a URL carrying no tokens', async () => {
        await expect(completeOAuthRedirect('fitup://auth/callback')).rejects.toBeInstanceOf(
            AuthError,
        );
    });

    test('rejects a half-populated fragment', async () => {
        await expect(
            completeOAuthRedirect('fitup://auth/callback#access_token=abc'),
        ).rejects.toMatchObject({ code: 'UNKNOWN' });
    });
});

describe('signOut', () => {
    /**
     * The app holds two credentials, and only one of them is Supabase's. The sync
     * service keeps its own JWT plus the user id it re-bootstraps from, and
     * `src/api`'s 401 interceptor will happily mint a fresh token from that id — so
     * a sign-out that clears only the session leaves the previous account able to
     * sync. Supabase is mocked as absent here, which is also the configuration that
     * proves the point: the sync credential must go either way.
     */
    test('clears the sync credential even when no account backend is configured', async () => {
        (clearAuthSession as jest.Mock).mockClear();

        await expect(signOut()).resolves.toBeUndefined();

        expect(clearAuthSession).toHaveBeenCalledTimes(1);
    });
});
