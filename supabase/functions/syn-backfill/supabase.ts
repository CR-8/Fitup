import type { CatalogueExerciseRow, CatalogueInstructionRow, Env } from './types.ts';

/**
 * Reads and writes over PostgREST, same shape as every other function's
 * `supabase.ts` in this project. Authenticated with the service-role key —
 * `exercise_embeddings` has RLS enabled with no policies at all (see
 * supabase/migrations/0005), so nothing but this key can write it.
 */

const request = async <T>(
    env: Env,
    path: string,
    init: RequestInit & { returning?: boolean } = {},
): Promise<T> => {
    const { returning = true, ...rest } = init;

    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
        ...rest,
        headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'content-type': 'application/json',
            prefer: returning ? 'return=representation' : 'return=minimal',
            ...(rest.headers as Record<string, string> | undefined),
        },
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase ${response.status}: ${detail.slice(0, 400)}`);
    }

    if (!returning || response.status === 204) return undefined as T;

    return (await response.json()) as T;
};

/**
 * One page of active exercises, keyset-paginated on `id` — the same pattern
 * `catalogue_page` uses, and for the same reason: this can be called
 * repeatedly across many invocations without an `OFFSET` making each one
 * slower than the last.
 */
export const listExercisePage = (
    env: Env,
    cursor: string | null,
    limit: number,
): Promise<CatalogueExerciseRow[]> => {
    const cursorFilter = cursor ? `&id=gt.${encodeURIComponent(cursor)}` : '';

    return request<CatalogueExerciseRow[]>(
        env,
        `catalogue_exercises?select=id,name,category,primary_muscle_groups,secondary_muscle_groups,equipment&is_active=is.true&order=id.asc&limit=${limit}${cursorFilter}`,
    );
};

/** English instructions for a batch of exercises, in one request. */
export const listEnglishInstructions = (
    env: Env,
    exerciseIds: string[],
): Promise<CatalogueInstructionRow[]> => {
    if (exerciseIds.length === 0) return Promise.resolve([]);

    const idList = exerciseIds.map((id) => encodeURIComponent(id)).join(',');

    return request<CatalogueInstructionRow[]>(
        env,
        `catalogue_instructions?select=exercise_id,steps&locale=eq.en&exercise_id=in.(${idList})`,
    );
};

export const upsertEmbeddings = (
    env: Env,
    rows: { exercise_id: string; content: string; embedding: number[] }[],
): Promise<void> =>
    request(env, 'exercise_embeddings?on_conflict=exercise_id', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.map((row) => ({ ...row, updated_at: new Date().toISOString() }))),
        returning: false,
    });
