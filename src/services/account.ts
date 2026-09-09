import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';

import { AUTH_CONFIG, isAuthConfigured } from '@/constants/auth';
import { requireSupabase, supabase } from '@/services/supabase';
import { reportError } from '@/services/error-reporting';

/**
 * Account sign-in.
 *
 * Signing in is optional and additive. Nothing here is required to train, log a
 * set, or read history — those paths never touch this module.
 */

export type AuthProvider = 'google' | 'email';

export type AuthFailureCode =
    | 'DISABLED'
    | 'CANCELLED'
    | 'INVALID_CREDENTIALS'
    | 'EMAIL_IN_USE'
    | 'WEAK_PASSWORD'
    | 'EMAIL_NOT_CONFIRMED'
    | 'LINK_EXPIRED'
    | 'RATE_LIMITED'
    | 'SAME_PASSWORD'
    | 'NETWORK'
    | 'UNSUPPORTED'
    | 'UNKNOWN';

export class AuthError extends Error {
    code: AuthFailureCode;

    constructor(code: AuthFailureCode, message?: string) {
        super(message ?? code);
        this.name = 'AuthError';
        this.code = code;
    }
}

/**
 * Maps Supabase's message strings onto codes the UI can translate. Supabase does
 * not expose stable error codes for these cases, so matching on the message is
 * the available option; an unmatched message degrades to a generic failure
 * rather than leaking raw provider text into the interface.
 */
const classifyAuthError = (error: unknown): AuthError => {
    if (error instanceof AuthError) return error;

    const message = error instanceof Error ? error.message.toLowerCase() : '';

    if (message.includes('invalid login credentials')) {
        return new AuthError('INVALID_CREDENTIALS');
    }
    if (message.includes('already registered') || message.includes('already been registered')) {
        return new AuthError('EMAIL_IN_USE');
    }
    if (message.includes('password should be') || message.includes('weak password')) {
        return new AuthError('WEAK_PASSWORD');
    }
    if (message.includes('email not confirmed')) {
        return new AuthError('EMAIL_NOT_CONFIRMED');
    }
    // Email links are single-use and time-limited, so this is the ordinary
    // outcome of tapping yesterday's message or tapping today's one twice.
    if (
        message.includes('otp_expired') ||
        message.includes('invalid or has expired') ||
        message.includes('token has expired')
    ) {
        return new AuthError('LINK_EXPIRED');
    }
    // Supabase answers a too-eager resend with "For security purposes, you can
    // only request this after N seconds".
    if (message.includes('only request this after') || message.includes('rate limit')) {
        return new AuthError('RATE_LIMITED');
    }
    if (message.includes('should be different from the old password')) {
        return new AuthError('SAME_PASSWORD');
    }
    if (message.includes('network') || message.includes('fetch')) {
        return new AuthError('NETWORK');
    }

    return new AuthError('UNKNOWN', error instanceof Error ? error.message : undefined);
};

export interface AccountIdentity {
    accountId: string;
    accountEmail: string | null;
    accountProvider: AuthProvider | null;
}

/**
 * The parts of a session the local user row mirrors.
 *
 * Lives here rather than beside either reader because two of them need it now —
 * the provider that prepares the account, and the navigation that has to wait
 * for it — and a second copy of "which provider is this" would drift.
 */
export const accountIdentityFromSession = (session: Session): AccountIdentity => {
    const provider = session.user.app_metadata.provider;

    return {
        accountId: session.user.id,
        accountEmail: session.user.email ?? null,
        accountProvider: provider === 'google' || provider === 'email' ? provider : null,
    };
};

export const getSession = async (): Promise<Session | null> => {
    if (!supabase) return null;

    const { data } = await supabase.auth.getSession();
    return data.session;
};

export const onAuthStateChange = (handler: (session: Session | null) => void): (() => void) => {
    if (!supabase) return () => undefined;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
    return () => data.subscription.unsubscribe();
};

/* -------------------------------------------------------------------------- */
/* Redirects                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The path half of every redirect the app hands to Supabase. Must stay in step
 * with the route that receives it as a deep link, `src/routes/auth/callback.tsx`
 * — the two are coupled by string, and nothing enforces that but this comment.
 *
 * One address serves all four cases: the OAuth hop, the sign-up confirmation
 * email, a resent confirmation, and the password-reset email. They are told
 * apart by the `type` the fragment carries, not by the path.
 */
const AUTH_REDIRECT_PATH = 'auth/callback';

/**
 * Exported because the email flows need the identical string and a second copy
 * would drift. It must also be listed in the Supabase project under
 * Authentication → URL Configuration → Redirect URLs; an address that is not on
 * that list is silently replaced with the project's Site URL, which opens a
 * browser instead of the app and looks exactly like a broken email.
 */
export const authRedirectUri = (): string =>
    AuthSession.makeRedirectUri({ scheme: 'fitup', path: AUTH_REDIRECT_PATH });

/** Supabase reports every outcome of a redirect in the callback fragment. */
const authResultParams = (url: string): URLSearchParams =>
    new URLSearchParams(url.split('#')[1] ?? '');

/**
 * Whether a URL carries an auth outcome at all.
 *
 * The app receives plenty of URLs that are not this one — the development client
 * launches on its own deep link, for instance — so a screen waiting for the redirect
 * has to be able to tell "not the callback" from "the callback, and it failed".
 */
export const isOAuthRedirectUrl = (url: string): boolean => {
    const params = authResultParams(url);
    return params.has('access_token') || params.has('error') || params.has('error_description');
};

/** What a redirect is for. Every landing carries tokens; only this tells them apart. */
export type AuthRedirectType = 'recovery' | 'signup';

/**
 * Which flow this callback belongs to.
 *
 * Load-bearing, and the reason a password reset used to be a silent sign-in: a
 * recovery link arrives carrying a full session, indistinguishable from a
 * sign-in unless the `type` is read. Landing it like any other redirect signed
 * the person straight into the account they had just told us they were locked
 * out of, leaving the forgotten password in place and no screen on which to
 * change it.
 *
 * Anything else — an OAuth hop, a magic link, an unrecognised type — is null and
 * lands the ordinary way.
 */
export const redirectType = (url: string): AuthRedirectType | null => {
    const type = authResultParams(url).get('type');

    return type === 'recovery' || type === 'signup' ? type : null;
};

/* -------------------------------------------------------------------------- */
/* Email and password                                                         */
/* -------------------------------------------------------------------------- */

export const signInWithEmail = async (email: string, password: string): Promise<Session> => {
    if (!isAuthConfigured()) throw new AuthError('DISABLED');

    try {
        const { data, error } = await requireSupabase().auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) throw error;
        if (!data.session) throw new AuthError('UNKNOWN');

        return data.session;
    } catch (error) {
        throw classifyAuthError(error);
    }
};

export interface SignUpResult {
    session: Session | null;
    /** True when the project requires the address to be confirmed by email. */
    needsEmailConfirmation: boolean;
}

export const signUpWithEmail = async (email: string, password: string): Promise<SignUpResult> => {
    if (!isAuthConfigured()) throw new AuthError('DISABLED');

    try {
        const { data, error } = await requireSupabase().auth.signUp({
            email: email.trim(),
            password,
            // Without this the confirmation link points at the project's Site
            // URL — a web page — so tapping it opens a browser and the app never
            // learns the address was confirmed. Sign-up was unfinishable.
            options: { emailRedirectTo: authRedirectUri() },
        });

        if (error) throw error;

        /**
         * An address that already has a *confirmed* account, reported without
         * saying so.
         *
         * Supabase will not tell a client that an address is taken — that would
         * turn this form into a way to ask whether a given person uses the app —
         * so it answers with an ordinary-looking success and sends no email at
         * all. `session` is null, `confirmation_sent_at` is even populated, and
         * none of that is true: all of it is the obfuscation.
         *
         * `identities` is the only field that gives it away, and the rule is
         * narrower than it first looks. Measured against the live project:
         *
         *   - address is new             -> identities populated, mail sent
         *   - exists but NOT confirmed   -> identities populated, mail RESENT
         *   - exists and IS confirmed    -> identities [], nothing sent
         *
         * The middle case is why this only rejects an empty array. Someone who
         * signed up and never received the mail should be able to ask again, and
         * Supabase genuinely does resend for them — so "check your email" is the
         * right screen there. Only the third case is a dead end, and without
         * this check it looked identical to mail that was merely slow.
         *
         * Never tested as falsy: the field is absent from some responses, and
         * reading "not told" as "taken" would refuse sign-ups that should have
         * gone through.
         */
        if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
            throw new AuthError('EMAIL_IN_USE');
        }

        return { session: data.session, needsEmailConfirmation: data.session === null };
    } catch (error) {
        throw classifyAuthError(error);
    }
};

/**
 * Sends the confirmation email again.
 *
 * Needed because the first one is genuinely easy to lose — filed as spam, or
 * sent to an address with a typo in it that the person has since noticed. The
 * alternative is telling them to create a second account.
 */
export const resendConfirmation = async (email: string): Promise<void> => {
    if (!isAuthConfigured()) throw new AuthError('DISABLED');

    try {
        const { error } = await requireSupabase().auth.resend({
            type: 'signup',
            email: email.trim(),
            options: { emailRedirectTo: authRedirectUri() },
        });

        if (error) throw error;
    } catch (error) {
        throw classifyAuthError(error);
    }
};

/**
 * Starts a password reset.
 *
 * Resolves the same way whether or not the address has an account. Supabase
 * answers identically by design, and reporting the difference here would turn
 * this screen into a way to ask whether a given person uses the app.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
    if (!isAuthConfigured()) throw new AuthError('DISABLED');

    try {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
            // Same reason as sign-up: without it the link leaves the app.
            redirectTo: authRedirectUri(),
        });

        if (error) throw error;
    } catch (error) {
        throw classifyAuthError(error);
    }
};

/**
 * Sets a new password on the session that is already open.
 *
 * Both callers reach it with a session in hand — the recovery link opens one of
 * its own, and Settings is only offered to someone already signed in — so there
 * is nothing to re-authenticate against here.
 */
export const updatePassword = async (password: string): Promise<void> => {
    if (!isAuthConfigured()) throw new AuthError('DISABLED');

    try {
        const { error } = await requireSupabase().auth.updateUser({ password });
        if (error) throw error;
    } catch (error) {
        throw classifyAuthError(error);
    }
};

/* -------------------------------------------------------------------------- */
/* Google                                                                     */
/* -------------------------------------------------------------------------- */

export const isGoogleAvailable = (): boolean => isAuthConfigured() && AUTH_CONFIG.googleEnabled;

/**
 * Decides which side of the redirect race is allowed to navigate.
 *
 * The callback can land twice: `openAuthSessionAsync` resolving and Android delivering
 * the deep link are not mutually exclusive. Both sides then want to move the user on,
 * and two `router.replace` calls for one sign-in show up as a flicker or as landing on
 * the wrong screen. A ref inside either screen cannot see the other, so the claim has
 * to live here, above both.
 */
let oauthNavigationClaimed = false;

/** Opens a fresh attempt; the previous winner no longer holds the claim. */
const beginOAuthAttempt = (): void => {
    oauthNavigationClaimed = false;
};

/** True for the first caller after an attempt begins, false for everyone after it. */
export const claimOAuthNavigation = (): boolean => {
    if (oauthNavigationClaimed) return false;
    oauthNavigationClaimed = true;
    return true;
};

/**
 * Where to land once this sign-in finishes, when it is not the first-launch flow.
 *
 * Lives here for the same reason the claim above does: the redirect can be
 * landed by either the sign-in screen or the callback screen, and only one of
 * them ever saw the search param that asked for a destination. A ref in either
 * screen is invisible to the other, so the intent has to sit above both.
 *
 * Null means "use the first-launch rules" — onboarding, or home if that is done.
 */
let pendingReturnTo: string | null = null;

export const setOAuthReturnTo = (path: string | null): void => {
    pendingReturnTo = path;
};

/** Read-and-clear, so a later sign-in does not inherit an old destination. */
export const consumeOAuthReturnTo = (): string | null => {
    const value = pendingReturnTo;
    pendingReturnTo = null;
    return value;
};

/**
 * Turns a callback URL into a session.
 *
 * The redirect reaches the app by one of two routes and which one wins is not ours
 * to decide: `openAuthSessionAsync` may capture it, or Android may deliver it as a
 * deep link first, waking the app on `/auth/callback`. Both funnel through here so
 * the tokens are never dropped on the floor.
 */
export const completeOAuthRedirect = async (url: string): Promise<Session> => {
    try {
        const params = authResultParams(url);

        // Backing out of the provider sheet comes back as an error, not an absence.
        if (params.has('error') || params.has('error_description')) {
            const reason = params.get('error');
            const description = params.get('error_description') ?? undefined;

            // Checked before `access_denied`, which an expired email link also
            // reports. Reading it as a cancellation is what made a stale link
            // bounce to sign-in with nothing said — the screen stays quiet about
            // CANCELLED on purpose, because that one is a choice.
            const expired =
                params.get('error_code') === 'otp_expired' ||
                (description?.toLowerCase().includes('expired') ?? false);

            if (expired) throw new AuthError('LINK_EXPIRED', description);

            throw new AuthError(
                reason === 'access_denied' ? 'CANCELLED' : 'UNKNOWN',
                description ?? reason ?? undefined,
            );
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) throw new AuthError('UNKNOWN');

        const { data, error } = await requireSupabase().auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (error) throw error;
        if (!data.session) throw new AuthError('UNKNOWN');

        return data.session;
    } catch (error) {
        throw classifyAuthError(error);
    }
};

/**
 * Google runs through the system browser rather than a webview, which is what
 * Google's own policy requires and what keeps an existing browser session usable.
 */
export const signInWithGoogle = async (): Promise<Session> => {
    if (!isGoogleAvailable()) throw new AuthError('DISABLED');

    beginOAuthAttempt();

    const client = requireSupabase();
    const redirectTo = authRedirectUri();

    try {
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, skipBrowserRedirect: true },
        });

        if (error) throw error;
        if (!data.url) throw new AuthError('UNKNOWN');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (result.type !== 'success') throw new AuthError('CANCELLED');

        return await completeOAuthRedirect(result.url);
    } catch (error) {
        throw classifyAuthError(error);
    } finally {
        WebBrowser.maybeCompleteAuthSession();
    }
};

/* -------------------------------------------------------------------------- */
/* Sign out                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ends the session.
 *
 * One credential now, where there used to be two: the Supabase session. The
 * second was the retired SyncLayer's own JWT, which had to be cleared alongside
 * it — clearing only the Supabase session left that one usable, so the sync
 * client's 401 interceptor could mint a fresh token for the account that had
 * just signed out. Both that layer and the trap are gone.
 *
 * Local training data is deliberately left in place: it was usable before any
 * account existed and stays usable after signing out.
 */
export const signOut = async (): Promise<void> => {
    try {
        await supabase?.auth.signOut();
    } catch (error) {
        reportError(error, 'Failed to sign out cleanly');
    }
};
