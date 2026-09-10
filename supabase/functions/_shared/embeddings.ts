/**
 * `gte-small`, run inside the Edge Function's own runtime.
 *
 * Shared between `supabase/functions/syn` (embeds a live query) and
 * `supabase/functions/syn-backfill` (embeds the catalogue), so the two never
 * drift into producing vectors from slightly different code — a real risk
 * given cosine similarity is meaningless between embeddings that were not
 * produced the same way. Supabase functions may import across directories
 * with a relative path; `_shared/` is the platform's own convention for code
 * exactly like this.
 *
 * `Supabase.ai` is a global the platform injects into every Edge Function; it
 * is not an import and needs no key, because the model runs on the same
 * machine as the function rather than being called out to. That is the whole
 * reason `gte-small` was chosen over a hosted embedding API: no external
 * credential, no per-token cost, one fewer thing to configure before this
 * works at all.
 *
 * A session is created once per cold start and reused, not once per request —
 * loading the model is the expensive part, and every request after the first
 * on a warm instance skips it entirely.
 */

// deno-lint-ignore no-explicit-any
declare const Supabase: any;

let session: unknown;

const getSession = () => {
    session ??= new Supabase.ai.Session('gte-small');
    return session;
};

/**
 * `mean_pool` and `normalize` are what make the output a single 384-length
 * unit vector rather than a per-token sequence — `mean_pool` collapses the
 * sequence to one vector, `normalize` is what makes cosine similarity (what
 * `<=>` computes in supabase/migrations/0005) meaningful across two embeddings
 * produced from very different text lengths.
 */
export const embed = async (text: string): Promise<number[]> => {
    const trimmed = text.trim();
    if (trimmed.length === 0) throw new Error('Cannot embed empty text');

    const output = (await (getSession() as { run: (input: string, opts: unknown) => Promise<unknown> }).run(
        trimmed,
        { mean_pool: true, normalize: true },
    )) as number[] | { data: number[] };

    // The documented shape is a plain number[]; unwrapped defensively in case
    // a future runtime version wraps it, since a shape change here would
    // otherwise fail silently as "384 zeros" rather than loudly.
    const vector = Array.isArray(output) ? output : output.data;

    if (!Array.isArray(vector) || vector.length !== 384) {
        throw new Error(`Unexpected embedding shape: ${JSON.stringify(vector).slice(0, 120)}`);
    }

    return vector;
};

/**
 * The passage embedded for one exercise.
 *
 * One chunk per exercise, not one per field: `gte-small` caps at 512 tokens
 * and a full exercise — name, category, muscles, equipment, instructions —
 * comfortably fits, so there is no chunking strategy to get right. Order
 * matters a little for embedding quality; name and muscles first is what a
 * short, truncated read of the passage still identifies correctly.
 */
export const buildExercisePassage = (input: {
    name: string;
    category: string;
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    equipment: string[];
    instructions: string[];
}): string => {
    const lines = [
        input.name,
        `Category: ${input.category}`,
        input.primaryMuscleGroups.length > 0
            ? `Primary muscles: ${input.primaryMuscleGroups.join(', ')}`
            : null,
        input.secondaryMuscleGroups.length > 0
            ? `Secondary muscles: ${input.secondaryMuscleGroups.join(', ')}`
            : null,
        `Equipment: ${input.equipment.length > 0 ? input.equipment.join(', ') : 'bodyweight'}`,
        input.instructions.length > 0 ? input.instructions.join(' ') : null,
    ];

    return lines.filter((line): line is string => line !== null).join('\n');
};
