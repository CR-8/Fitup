/**
 * Same shape as `supabase/functions/syn-backfill/types.ts`, and the same
 * reason: this is a human or a cron job triggering a maintenance send, not
 * the app calling in, so it substitutes basic auth for the platform's
 * default JWT check — see `verify_jwt = false` for this function in
 * supabase/config.toml.
 */
export interface Env {
    ADMIN_USER: string;
    ADMIN_PASSWORD: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
    /**
     * Optional. Expo's push endpoint works with no credential at all, but
     * accepts an access token to raise rate limits and to let the sender be
     * identified in Expo's own dashboard — see
     * https://docs.expo.dev/push-notifications/sending-notifications/#additional-security.
     * Absent, sends still go out unauthenticated.
     */
    EXPO_ACCESS_TOKEN?: string;
}

const required = (name: string, value: string | undefined): string => {
    if (!value) {
        throw new Error(
            `${name} is not set. Platform values are injected automatically; the two ` +
                'operator credentials come from `supabase secrets set ADMIN_USER=… ' +
                'ADMIN_PASSWORD=…` — reuse the same values already set for the CMS.',
        );
    }

    return value;
};

export const readEnv = (): Env => ({
    ADMIN_USER: required('ADMIN_USER', Deno.env.get('ADMIN_USER')),
    ADMIN_PASSWORD: required('ADMIN_PASSWORD', Deno.env.get('ADMIN_PASSWORD')),
    SUPABASE_URL: required('SUPABASE_URL', Deno.env.get('SUPABASE_URL')),
    SUPABASE_SERVICE_KEY: required(
        'SUPABASE_SERVICE_ROLE_KEY',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'),
    ),
    EXPO_ACCESS_TOKEN: Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined,
});

export interface PushRecipient {
    account_id: string;
    expo_push_token: string;
    locale: string;
}

export interface NudgeRunResult {
    recipients: number;
    sent: number;
    /** Expo's own per-message errors, e.g. `DeviceNotRegistered` for a stale token. */
    ticketErrors: number;
}
