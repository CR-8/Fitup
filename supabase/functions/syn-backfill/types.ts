/**
 * The backfill's environment.
 *
 * Same `ADMIN_USER` / `ADMIN_PASSWORD` shape as `supabase/functions/cms`, for
 * the same reason: this is a human running a one-off maintenance job from a
 * terminal, not the app calling in, so it substitutes HTTP basic auth for the
 * platform's default JWT check — which is why this function must also be
 * deployed with `--no-verify-jwt` (see supabase/config.toml).
 */
export interface Env {
    ADMIN_USER: string;
    ADMIN_PASSWORD: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
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
});

export interface CatalogueExerciseRow {
    id: string;
    name: string;
    category: string;
    primary_muscle_groups: string[];
    secondary_muscle_groups: string[];
    equipment: string[];
}

export interface CatalogueInstructionRow {
    exercise_id: string;
    steps: string[];
}

export interface BackfillProgress {
    processed: number;
    nextCursor: string | null;
    done: boolean;
}
