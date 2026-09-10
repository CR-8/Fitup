import { AUTH_CONFIG } from '@/constants/auth';
import type { AiConditionGuidance } from '@/types/ai';

/**
 * The one network call retrieval adds: `supabase/functions/syn`'s
 * `/retrieve` route, which embeds a query with `gte-small` and returns the
 * catalogue rows and condition guidance that actually apply to it — see
 * supabase/migrations/0005.
 *
 * Reuses the Supabase project every other account feature already points at
 * rather than a separate `EXPO_PUBLIC_` variable: retrieval is meaningless
 * without the same project holding `exercise_embeddings`, so a second flag
 * would only be one more way for the two to end up pointed at different
 * places. Retrieval is available exactly when accounts are configured, and
 * is silently absent otherwise — this module never throws, only ever
 * resolves `null`, so a caller has one fallback to write, not a try/catch
 * around every failure mode.
 */

const SUPABASE_URL = (AUTH_CONFIG.supabaseUrl ?? '').replace(/\/+$/, '');
const SUPABASE_KEY = AUTH_CONFIG.supabaseAnonKey ?? '';

/**
 * The Edge Function does real work per call — an embedding, then a vector
 * search — so this is generous next to a plain PostgREST read, but still
 * bounded: a plan the user is waiting on should not hang indefinitely because
 * the function is cold-starting or the model is unreachable.
 */
const TIMEOUT_MS = 8_000;

export const isSynRetrievalConfigured = (): boolean =>
    SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

export interface SynRetrievalRequest {
    /** What to embed — the plan's intent, or the exercise being explained. */
    query: string;
    equipment: string[];
    conditions: string[];
    locale: string;
    matchCount: number;
}

export interface SynRetrievalResult {
    /** Ranked, most similar first. Cross-referenced against the local catalogue by the caller. */
    candidateIds: string[];
    guidance: AiConditionGuidance[];
}

interface RetrieveResponseBody {
    candidates?: { id: string }[];
    guidance?: { condition: string; title: string; body: string }[];
}

/**
 * Never throws. A misconfigured project, a network failure, a timeout, or a
 * response that does not parse all resolve `null` — every one of them means
 * the same thing to a caller: fall back to the unranked candidate list this
 * app already had before retrieval existed.
 */
export const retrieveForPlan = async (
    request: SynRetrievalRequest,
): Promise<SynRetrievalResult | null> => {
    if (!isSynRetrievalConfigured()) return null;

    const query = request.query.trim();
    if (query.length === 0) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/syn/retrieve`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                authorization: `Bearer ${SUPABASE_KEY}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                query,
                equipment: request.equipment,
                conditions: request.conditions,
                locale: request.locale,
                matchCount: request.matchCount,
            }),
            signal: controller.signal,
        });

        if (!response.ok) return null;

        const body = (await response.json()) as RetrieveResponseBody;
        const candidates = Array.isArray(body.candidates) ? body.candidates : [];
        const guidance = Array.isArray(body.guidance) ? body.guidance : [];

        return {
            candidateIds: candidates
                .map((entry) => entry.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0),
            guidance: guidance.filter(
                (entry): entry is AiConditionGuidance =>
                    typeof entry.condition === 'string' &&
                    typeof entry.title === 'string' &&
                    typeof entry.body === 'string',
            ),
        };
    } catch {
        // Network failure, abort, or a response that was not JSON — all the
        // same outcome to the caller. Not reported to Sentry: an
        // unconfigured or unreachable retrieval endpoint is not actionable
        // there and degrading silently is the entire point of this module.
        return null;
    } finally {
        clearTimeout(timeout);
    }
};
