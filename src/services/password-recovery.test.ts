import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/**
 * The flag that stands between a reset link and the account it opens.
 *
 * A recovery link is a session, not a message: Supabase signs the recipient in
 * and trusts the app to insist on a new password first. Nothing in the session
 * records that, so if this flag is wrong the failure is total and silent — the
 * gate reads an ordinary sign-in, routes to Home, and the password the person
 * came to change is still the live one.
 *
 * Backed by storage rather than memory for the case that made it necessary:
 * force-quitting on the password screen. In memory that leaves someone signed
 * in to an account they cannot get back into; in storage the next launch puts
 * them back where they were.
 */

const mockStore = new Map<string, boolean>();
let mockThrowOnAccess = false;

jest.mock('@/storage', () => ({
    storage: {
        set: (key: string, value: boolean) => {
            if (mockThrowOnAccess) throw new Error('storage is unavailable');
            mockStore.set(key, value);
        },
        getBoolean: (key: string) => {
            if (mockThrowOnAccess) throw new Error('storage is unavailable');
            return mockStore.get(key);
        },
        remove: (key: string) => {
            if (mockThrowOnAccess) throw new Error('storage is unavailable');
            return mockStore.delete(key);
        },
    },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = () => require('@/services/password-recovery');

describe('the password recovery flag', () => {
    beforeEach(() => {
        mockStore.clear();
        mockThrowOnAccess = false;
        jest.resetModules();
    });

    test('is not set by default', () => {
        expect(load().isPasswordRecoveryPending()).toBe(false);
    });

    test('is set for the length of the flow and cleared at the end of it', () => {
        const { beginPasswordRecovery, endPasswordRecovery, isPasswordRecoveryPending } = load();

        beginPasswordRecovery();
        expect(isPasswordRecoveryPending()).toBe(true);

        endPasswordRecovery();
        expect(isPasswordRecoveryPending()).toBe(false);
    });

    test('survives the app being killed mid-flow', () => {
        load().beginPasswordRecovery();

        // A fresh module registry is as close as a test gets to a cold start.
        // Held in module scope this would come back false, and the launch would
        // land on Home with the old password still in force.
        jest.resetModules();

        expect(load().isPasswordRecoveryPending()).toBe(true);
    });

    test('unreadable storage reports no recovery rather than throwing', () => {
        const { isPasswordRecoveryPending } = load();

        mockThrowOnAccess = true;

        // Wrong, but wrong in the direction that still lets the app open. The
        // way back is Settings → Change password.
        expect(isPasswordRecoveryPending()).toBe(false);
    });

    test('an unwritable store does not take the sign-in down with it', () => {
        const { beginPasswordRecovery, endPasswordRecovery } = load();

        mockThrowOnAccess = true;

        expect(() => beginPasswordRecovery()).not.toThrow();
        expect(() => endPasswordRecovery()).not.toThrow();
    });
});
