/**
 * Syn's retrieval environment.
 *
 * Same shape as `supabase/functions/cms/types.ts` for the same reason: Edge
 * Functions have no per-request bindings, so credentials are read once from
 * `Deno.env` at startup rather than threaded through every call.
 *
 * There is no `ADMIN_USER` / `ADMIN_PASSWORD` here. This function is called by
 * the app itself, under the caller's own Supabase auth context (a session, or
 * the publishable key for a signed-out install) — not by a human at a
 * dashboard — so it keeps the platform's default JWT verification rather than
 * substituting basic auth the way the CMS does.
 */
export interface Env {
    SUPABASE_URL: string;
    /**
     * The service-role key. `match_exercises` and `match_condition_guidance`
     * are granted to `service_role` only (see supabase/migrations/0005) — an
     * anonymous or signed-in device is never trusted to run a raw vector
     * search itself, both because the query embedding step costs real compute
     * and because the equipment/condition filters are safety-relevant and
     * belong entirely server-side. Every use of this key is a server-to-server
     * fetch from inside this function; it must never reach the app.
     */
    SUPABASE_SERVICE_KEY: string;
}

const required = (name: string, value: string | undefined): string => {
    if (!value) {
        throw new Error(`${name} is not set. Platform values are injected automatically.`);
    }

    return value;
};

export const readEnv = (): Env => ({
    SUPABASE_URL: required('SUPABASE_URL', Deno.env.get('SUPABASE_URL')),
    SUPABASE_SERVICE_KEY: required(
        'SUPABASE_SERVICE_ROLE_KEY',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'),
    ),
});

/** The request body the app sends. Every field but `query` is optional. */
export interface RetrieveRequest {
    /** What the user is asking for or describing — the text that gets embedded. */
    query: string;
    /** Equipment the user has declared. Empty or omitted means "don't filter". */
    equipment?: string[];
    /** Condition ids from ai_profile.conditions, e.g. 'knee_injury'. */
    conditions?: string[];
    /** BCP-47-ish locale for guidance text; falls back to English per row. */
    locale?: string;
    /** Defaults to AI_EXERCISE_CANDIDATE_LIMIT on the app side (60). */
    matchCount?: number;
}

export interface RetrievedCandidate {
    id: string;
    name: string;
    category: string;
    similarity: number;
}

export interface RetrievedGuidance {
    condition: string;
    title: string;
    body: string;
}

export interface RetrieveResponse {
    candidates: RetrievedCandidate[];
    guidance: RetrievedGuidance[];
}
