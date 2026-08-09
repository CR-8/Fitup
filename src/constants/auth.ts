/**
 * Account configuration.
 *
 * Accounts are optional. The app is local-first: training, logging and history
 * work with no account and no network. Signing in adds cross-device sync, backup
 * and the assistant. Leaving EXPO_PUBLIC_SUPABASE_URL empty ships a build with
 * no accounts at all, and the sign-in screen never appears.
 */

const readString = (value: string | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
    const raw = readString(value)?.toLowerCase();
    if (raw === null || raw === undefined) return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
};

const supabaseUrl = readString(process.env.EXPO_PUBLIC_SUPABASE_URL);

/**
 * The anon key is designed to be public — it identifies the project and carries
 * no privileges beyond what row-level security allows. It is not a secret, and
 * shipping it in the binary is the intended usage. The service-role key is a
 * secret and must never appear in the client.
 */
const supabaseAnonKey = readString(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export const AUTH_CONFIG = {
    supabaseUrl,
    supabaseAnonKey,

    /** Google is offered when a client id is configured for the platform. */
    googleEnabled: readBoolean(process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED, true),

    /**
     * Apple is required by App Review guideline 4.8 on iOS whenever another
     * social login is offered, so it defaults on and is only disabled for
     * builds that ship no social login at all.
     */
    appleEnabled: readBoolean(process.env.EXPO_PUBLIC_AUTH_APPLE_ENABLED, true),

    emailEnabled: readBoolean(process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED, true),
} as const;

export const isAuthConfigured = (): boolean =>
    AUTH_CONFIG.supabaseUrl !== null && AUTH_CONFIG.supabaseAnonKey !== null;

/** Minimum password length accepted locally, matching Supabase's own default. */
export const MIN_PASSWORD_LENGTH = 6;
