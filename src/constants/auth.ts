/**
 * Account configuration.
 *
 * An account is required to use the app. The data stays local-first — training,
 * logging and history are read and written on the device, with no network — but
 * the app is held behind sign-in, and signing out returns to it.
 *
 * `isAuthConfigured()` is what enforces that, so leaving EXPO_PUBLIC_SUPABASE_URL
 * or EXPO_PUBLIC_SUPABASE_ANON_KEY empty does the opposite of locking the build
 * down: it ships one with no accounts at all, where the requirement cannot be
 * satisfied and is therefore not applied. That is the only configuration in
 * which the app opens signed out.
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

    emailEnabled: readBoolean(process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED, true),
} as const;

export const isAuthConfigured = (): boolean =>
    AUTH_CONFIG.supabaseUrl !== null && AUTH_CONFIG.supabaseAnonKey !== null;

/** Minimum password length accepted locally, matching Supabase's own default. */
export const MIN_PASSWORD_LENGTH = 6;
