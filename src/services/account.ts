import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';

import { AUTH_CONFIG, isAuthConfigured } from '@/constants/auth';
import { requireSupabase, supabase } from '@/services/supabase';
import { clearAuthSession } from '@/services/auth';
import { reportError } from '@/services/error-reporting';

/**
 * Account sign-in.
 *
 * Signing in is optional and additive. Nothing here is required to train, log a
 * set, or read history — those paths never touch this module.
 */

export type AuthProvider = 'google' | 'apple' | 'email';

export type AuthFailureCode =
    | 'DISABLED'
    | 'CANCELLED'
    | 'INVALID_CREDENTIALS'
    | 'EMAIL_IN_USE'
    | 'WEAK_PASSWORD'
    | 'EMAIL_NOT_CONFIRMED'
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
        accountProvider:
            provider === 'google' || provider === 'apple' || provider === 'email' ? provider : null,
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
        });

        if (error) throw error;

        return { session: data.session, needsEmailConfirmation: data.session === null };
    } catch (error) {
        throw classifyAuthError(error);
    }
};

export const sendPasswordReset = async (email: string): Promise<void> => {
    if (!isAuthConfigured()) throw new AuthError('DISABLED');

    try {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim());
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
 * The path half of the OAuth redirect. Must stay in step with the route that receives
 * it as a deep link, `src/routes/auth/callback.tsx` — the two are coupled by string,
 * and nothing enforces that but this comment.
 */
const OAUTH_REDIRECT_PATH = 'auth/callback';

const oauthRedirectUri = (): string =>
    AuthSession.makeRedirectUri({ scheme: 'fitup', path: OAUTH_REDIRECT_PATH });

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

/** Supabase reports both outcomes of the OAuth hop in the callback fragment. */
const oauthResultParams = (url: string): URLSearchParams =>
    new URLSearchParams(url.split('#')[1] ?? '');

/**
 * Whether a URL carries an OAuth outcome at all.
 *
 * The app receives plenty of URLs that are not this one — the development client
 * launches on its own deep link, for instance — so a screen waiting for the redirect
 * has to be able to tell "not the callback" from "the callback, and it failed".
 */
export const isOAuthRedirectUrl = (url: string): boolean => {
    const params = oauthResultParams(url);
    return params.has('access_token') || params.has('error') || params.has('error_description');
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
        const params = oauthResultParams(url);

        // Backing out of the provider sheet comes back as an error, not an absence.
        if (params.has('error') || params.has('error_description')) {
            const reason = params.get('error');
            throw new AuthError(
                reason === 'access_denied' ? 'CANCELLED' : 'UNKNOWN',
                params.get('error_description') ?? reason ?? undefined,
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
    const redirectTo = oauthRedirectUri();

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
/* Apple                                                                      */
/* -------------------------------------------------------------------------- */

export const isAppleAvailable = async (): Promise<boolean> => {
    if (!isAuthConfigured() || !AUTH_CONFIG.appleEnabled) return false;
    if (Platform.OS !== 'ios') return false;

    return await AppleAuthentication.isAvailableAsync();
};

/**
 * Apple's native flow returns an identity token that Supabase verifies directly,
 * so there is no browser round trip. A nonce is generated and its SHA-256 sent to
 * Apple, which binds the returned token to this request.
 */
export const signInWithApple = async (): Promise<Session> => {
    if (!(await isAppleAvailable())) throw new AuthError('UNSUPPORTED');

    // Apple returns its token inline with no redirect, so nothing races it — but the
    // claim still has to be reopened, or a previous Google attempt would hold it and
    // this sign-in would complete without ever moving the user on.
    beginOAuthAttempt();

    try {
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            rawNonce,
        );

        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
        });

        if (!credential.identityToken) throw new AuthError('UNKNOWN');

        const { data, error } = await requireSupabase().auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
        });

        if (error) throw error;
        if (!data.session) throw new AuthError('UNKNOWN');

        return data.session;
    } catch (error) {
        if (
            error instanceof Error &&
            'code' in error &&
            (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
        ) {
            throw new AuthError('CANCELLED');
        }

        throw classifyAuthError(error);
    }
};

/* -------------------------------------------------------------------------- */
/* Sign out                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ends the session completely.
 *
 * Two credentials exist, not one: the Supabase session, and the sync service's
 * own JWT with the user id it re-bootstraps from. Clearing only the first left
 * the second usable, so `src/api`'s 401 interceptor could mint a fresh sync
 * token for the account that had just signed out.
 *
 * The sync credential is cleared even when Supabase is absent — the two are
 * configured independently, and "signed out" has to mean the same thing either
 * way.
 *
 * Local training data is deliberately left in place: it was usable before any
 * account existed and stays usable after signing out.
 */
export const signOut = async (): Promise<void> => {
    try {
        await supabase?.auth.signOut();
    } catch (error) {
        reportError(error, 'Failed to sign out cleanly');
    } finally {
        clearAuthSession();
    }
};
