import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
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
 * Google runs through the system browser rather than a webview, which is what
 * Google's own policy requires and what keeps an existing browser session usable.
 */
export const signInWithGoogle = async (): Promise<Session> => {
    if (!isGoogleAvailable()) throw new AuthError('DISABLED');

    const client = requireSupabase();
    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'fitup', path: 'auth/callback' });

    try {
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, skipBrowserRedirect: true },
        });

        if (error) throw error;
        if (!data.url) throw new AuthError('UNKNOWN');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (result.type !== 'success') throw new AuthError('CANCELLED');

        // Supabase returns the tokens in the callback fragment.
        const fragment = result.url.split('#')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) throw new AuthError('UNKNOWN');

        const { data: sessionData, error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (sessionError) throw sessionError;
        if (!sessionData.session) throw new AuthError('UNKNOWN');

        return sessionData.session;
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
 * Ends the session. Local training data is deliberately left in place: it was
 * usable before any account existed and stays usable after signing out.
 */
export const signOut = async (): Promise<void> => {
    if (!supabase) return;

    try {
        await supabase.auth.signOut();
    } catch (error) {
        reportError(error, 'Failed to sign out cleanly');
    }
};
