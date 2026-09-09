import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { setOAuthReturnTo } from '@/services/account';
import { resolveAuthDestination } from '@/services/auth-navigation';

/**
 * Guards where a completed sign-in sends the user.
 *
 * Two screens finish a sign-in — the sign-in screen and the OAuth callback —
 * and they used to carry separate copies of this decision. The interesting
 * cases are the ones that only appear once sign-in is reachable from Settings:
 * a destination that must survive the hop through the browser, and one that
 * must not be reusable afterwards.
 */

jest.mock('@/services/supabase', () => ({
    supabase: null,
    requireSupabase: () => {
        throw new Error('Supabase is not configured for this build');
    },
}));

jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));

// Reached only through `account`'s sign-out path, which these tests never call.
// Stubbed because the real module pulls in nanoid, which ships as ESM.

jest.mock('@/constants/auth', () => ({
    AUTH_CONFIG: { googleEnabled: true },
    isAuthConfigured: () => true,
}));

const mockHasCompletedOnboarding = jest.fn<(id: string) => Promise<boolean>>();
jest.mock('@/crud/onboarding', () => ({
    hasCompletedOnboarding: (id: string) => mockHasCompletedOnboarding(id),
}));

// The destination is resolved from the session's own user rather than from
// whichever row the calling screen was holding, so this is the seam that
// decides whose onboarding status is read.
const mockCurrentUserForSession = jest.fn<() => Promise<{ id: string } | null>>();
jest.mock('@/services/backup', () => ({
    currentUserForSession: () => mockCurrentUserForSession(),
}));

beforeEach(() => {
    setOAuthReturnTo(null);
    mockHasCompletedOnboarding.mockReset();
    mockHasCompletedOnboarding.mockResolvedValue(true);
    mockCurrentUserForSession.mockReset();
    mockCurrentUserForSession.mockResolvedValue({ id: 'user-1' });
});

describe('first-launch rules', () => {
    test('sends a new user to onboarding', async () => {
        mockHasCompletedOnboarding.mockResolvedValue(false);

        expect(await resolveAuthDestination()).toBe('/onboarding');
    });

    test('sends a returning user straight to training', async () => {
        mockHasCompletedOnboarding.mockResolvedValue(true);

        expect(await resolveAuthDestination()).toBe('/');
    });

    test('treats a missing user as not onboarded', async () => {
        mockCurrentUserForSession.mockResolvedValue(null);

        expect(await resolveAuthDestination()).toBe('/onboarding');
        expect(mockHasCompletedOnboarding).not.toHaveBeenCalled();
    });

    test("reads the session's own user, not the one the screen was holding", async () => {
        mockCurrentUserForSession.mockResolvedValue({ id: 'second-account' });
        mockHasCompletedOnboarding.mockResolvedValue(false);

        expect(await resolveAuthDestination()).toBe('/onboarding');
        expect(mockHasCompletedOnboarding).toHaveBeenCalledWith('second-account');
    });
});

describe('returning to where the user came from', () => {
    test('a registered destination wins over the first-launch rules', async () => {
        setOAuthReturnTo('/settings/account');

        // Onboarded would otherwise send them to '/', losing their place.
        expect(await resolveAuthDestination()).toBe('/settings/account');
    });

    test('the destination is consumed, so a later sign-in does not reuse it', async () => {
        setOAuthReturnTo('/settings/account');

        expect(await resolveAuthDestination()).toBe('/settings/account');
        // Signing in again from the first-launch gate must not land in Settings.
        expect(await resolveAuthDestination()).toBe('/');
    });

    test('does not consult onboarding when a destination is set', async () => {
        setOAuthReturnTo('/settings/account');
        await resolveAuthDestination();

        expect(mockHasCompletedOnboarding).not.toHaveBeenCalled();
    });
});

describe('rejecting destinations that are not in-app paths', () => {
    // The destination arrives from a search param, which a deep link can set.
    test.each([
        ['an absolute url', 'https://example.test/phish'],
        ['a protocol-relative url', '//example.test'],
        ['another app scheme', 'fitup://auth/callback'],
        ['a bare path with no leading slash', 'settings/account'],
    ])('ignores %s', async (_label, candidate) => {
        setOAuthReturnTo(candidate);

        expect(await resolveAuthDestination()).toBe('/');
    });
});
