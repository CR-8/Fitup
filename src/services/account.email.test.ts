import { describe, expect, jest, test } from '@jest/globals';

/**
 * Guards that every email Supabase sends carries a link back into the app.
 *
 * A missing `redirectTo` fails in the quietest way this codebase has produced:
 * the call succeeds, the email arrives, and the link opens a browser on the
 * project's Site URL. Nothing throws, nothing is logged, and the app never
 * learns the address was confirmed — so sign-up simply could not be finished,
 * and the password reset that had no caller at all would have had the same
 * fault the day it got one.
 *
 * The value is asserted against `authRedirectUri()` rather than a literal,
 * because the point is that all four flows agree on one address — the same one
 * `src/routes/auth/callback.tsx` receives and the Supabase project allows.
 */

const captured: { table: string; args: unknown[] }[] = [];

const DEFAULT_REPLY = { data: { session: null, user: null }, error: null };

/**
 * What the mocked Supabase answers a sign-up with.
 *
 * A fixed reply was enough while every test only cared what was *sent*. The
 * sign-up tests below care what comes *back*: `identities` is the only thing
 * separating a new account from an address that already has one, and Supabase
 * returns an identical `session: null` for both.
 */
let signUpReply: { data: unknown; error: unknown } = DEFAULT_REPLY;

const record =
    (name: string) =>
    async (...args: unknown[]) => {
        captured.push({ table: name, args });
        return name === 'signUp' ? signUpReply : DEFAULT_REPLY;
    };

jest.mock('@/services/supabase', () => ({
    supabase: {},
    requireSupabase: () => ({
        auth: {
            signUp: record('signUp'),
            resend: record('resend'),
            resetPasswordForEmail: record('resetPasswordForEmail'),
            updateUser: record('updateUser'),
        },
    }),
}));

/**
 * `makeRedirectUri` reads the scheme out of the expo-constants manifest, which
 * only exists in a running app. The value it returns is not what is under test —
 * the wiring is: that all four flows hand Supabase the same one address.
 */
jest.mock('expo-auth-session', () => ({
    makeRedirectUri: ({ scheme, path }: { scheme: string; path: string }) => `${scheme}://${path}`,
}));

jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));
jest.mock('@/constants/auth', () => ({
    AUTH_CONFIG: { googleEnabled: true },
    isAuthConfigured: () => true,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const account = require('@/services/account');

const argsFor = (name: string): Record<string, unknown>[] =>
    captured.filter((call) => call.table === name).map((call) => call.args as never)[0] ?? [];

describe('the address every email link comes back to', () => {
    test('is a deep link into this app, not a web page', () => {
        // The path half must stay in step with `src/routes/auth/callback.tsx`,
        // and with the Redirect URLs list in the Supabase project. Both are
        // coupled to this string and neither can be checked from here.
        expect(account.authRedirectUri()).toBe('fitup://auth/callback');
    });

    test('sign-up asks for the confirmation to land there', async () => {
        captured.length = 0;

        await account.signUpWithEmail('someone@example.com', 'hunter22');

        const [payload] = argsFor('signUp');

        expect((payload.options as Record<string, unknown>).emailRedirectTo).toBe(
            account.authRedirectUri(),
        );
    });

    test('a resent confirmation asks for the same', async () => {
        captured.length = 0;

        await account.resendConfirmation('someone@example.com');

        const [payload] = argsFor('resend');

        expect(payload.type).toBe('signup');
        expect((payload.options as Record<string, unknown>).emailRedirectTo).toBe(
            account.authRedirectUri(),
        );
    });

    test('a password reset asks for the same', async () => {
        captured.length = 0;

        await account.sendPasswordReset('someone@example.com');

        const [, options] = argsFor('resetPasswordForEmail');

        expect(options.redirectTo).toBe(account.authRedirectUri());
    });

    test('the address is trimmed before it is sent', async () => {
        captured.length = 0;

        await account.sendPasswordReset('  someone@example.com  ');

        const [email] = argsFor('resetPasswordForEmail') as unknown as string[];

        expect(email).toBe('someone@example.com');
    });
});

/**
 * Supabase answers a sign-up for an address that already has a *confirmed*
 * account with a success, not an error, and sends no email — it will not
 * confirm that an address is taken, because the form would then be a way to ask
 * whether a given person uses the app.
 *
 * `identities` is the only signal, and the three cases below were measured
 * against the live project rather than assumed:
 *
 *   new address           -> identities populated, mail sent
 *   exists, unconfirmed   -> identities populated, mail RESENT
 *   exists, confirmed     -> identities [], nothing sent
 *
 * Only the last is a dead end. Getting it wrong is invisible by hand — it looks
 * exactly like an email that is slow to arrive — which is why it is pinned here.
 */
describe('signing up with an address that already has an account', () => {
    test('a confirmed address is EMAIL_IN_USE, not "check your email"', async () => {
        captured.length = 0;
        signUpReply = {
            data: { session: null, user: { id: 'existing', identities: [] } },
            error: null,
        };

        await expect(
            account.signUpWithEmail('taken@example.com', 'hunter22'),
        ).rejects.toMatchObject({ code: 'EMAIL_IN_USE' });

        signUpReply = DEFAULT_REPLY;
    });

    // Covers both populated cases: a new address, and an existing unconfirmed
    // one that Supabase resends for. Neither may be turned into an error —
    // an email really was sent, so "check your email" is the correct screen.
    test('a populated identities list still asks the user to confirm', async () => {
        captured.length = 0;
        signUpReply = {
            data: {
                session: null,
                user: { id: 'fresh', identities: [{ provider: 'email' }] },
            },
            error: null,
        };

        const result = await account.signUpWithEmail('fresh@example.com', 'hunter22');

        expect(result.needsEmailConfirmation).toBe(true);

        signUpReply = DEFAULT_REPLY;
    });

    test('a response that omits identities is not read as "taken"', async () => {
        captured.length = 0;
        // Absent, not empty. Treating "not told" as "taken" would refuse
        // sign-ups that should have gone through.
        signUpReply = { data: { session: null, user: { id: 'fresh' } }, error: null };

        await expect(
            account.signUpWithEmail('fresh@example.com', 'hunter22'),
        ).resolves.toMatchObject({ needsEmailConfirmation: true });

        signUpReply = DEFAULT_REPLY;
    });
});

describe('setting a new password', () => {
    test('changes the password on the open session and nothing else', async () => {
        captured.length = 0;

        await account.updatePassword('a-longer-one');

        expect(argsFor('updateUser')[0]).toEqual({ password: 'a-longer-one' });
    });
});
