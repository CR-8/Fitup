import type { Env, RetrievedCandidate, RetrievedGuidance } from './types.ts';

/**
 * The two calls this function makes to Postgres, over PostgREST.
 *
 * Same `fetch`-over-`rpc/*` shape as `supabase/functions/cms/supabase.ts`, and
 * the same reason for it: a wrapping client would cost bundle size on every
 * cold start for two requests it does not need to generalise.
 *
 * Authenticated with the service-role key. `supabase/migrations/0005` grants
 * `match_exercises` and `match_condition_guidance` to `service_role` only —
 * there is no policy under which `anon` or `authenticated` could call them
 * directly, which is deliberate: the equipment and condition filters are
 * safety-relevant and are not something to trust a client to apply correctly.
 */

const rpc = async <T>(env: Env, name: string, args: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify(args),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase rpc/${name} ${response.status}: ${detail.slice(0, 400)}`);
    }

    return (await response.json()) as T;
};

/**
 * `p_equipment` and `p_block_patterns` are passed through even when empty —
 * the migration's own SQL already treats null/empty as "no filter", so there
 * is nothing this layer needs to special-case.
 */
export const matchExercises = (
    env: Env,
    embedding: number[],
    matchCount: number,
    equipment: string[],
    blockPatterns: string[],
): Promise<RetrievedCandidate[]> =>
    rpc<RetrievedCandidate[]>(env, 'match_exercises', {
        p_embedding: embedding,
        p_match_count: matchCount,
        p_equipment: equipment.length > 0 ? equipment : null,
        p_block_patterns: blockPatterns.length > 0 ? blockPatterns : null,
    });

export const matchConditionGuidance = (
    env: Env,
    conditions: string[],
    locale: string,
): Promise<RetrievedGuidance[]> => {
    if (conditions.length === 0) return Promise.resolve([]);

    return rpc<RetrievedGuidance[]>(env, 'match_condition_guidance', {
        p_conditions: conditions,
        p_locale: locale,
    });
};
