import { LOCALES, type CatalogueEntry, type Locale } from './dataset';
import type { UploadedAsset } from './cloudinary';
import { connectSupabase, type SupabaseClient } from './supabase';

/**
 * Catalogue writes for the seed run, against Supabase.
 *
 * This used to talk to Cloudflare D1 over its REST API, and most of what was
 * here existed to work around that. D1 caps a query at 100 bound parameters, so
 * the number of rows per statement was fixed by column count — 7 exercises or
 * 25 instructions at a time — and the SQL was assembled by hand with a
 * `placeholders()` helper to match. None of that survives the move: PostgREST
 * takes an upsert as one JSON array, so batching is now only about keeping a
 * request a sensible size, and lives in `lib/supabase.ts`.
 *
 * The exported shape is unchanged, so `seed-catalogue.ts` did not have to move
 * with it.
 */

export type { SupabaseClient as CatalogueClient };

/**
 * Opens the client.
 *
 * Async only because the call site awaits it and there is no reason to churn
 * that. There is no connection to open: PostgREST is HTTP, so each request
 * stands alone and there is nothing to close afterwards either.
 */
export const connect = async (): Promise<SupabaseClient> => connectSupabase();

export interface SeededExercise {
    entry: CatalogueEntry;
    asset: UploadedAsset;
}

/**
 * Upserts catalogue rows.
 *
 * `is_active` is deliberately absent from the payload. PostgREST's
 * `merge-duplicates` writes `on conflict do update set` for the columns it is
 * given and no others, so leaving it out means a re-seed cannot resurrect an
 * exercise somebody deactivated in the CMS — while a genuinely new row still
 * picks up the column's `default true`. That is exactly how the D1 version
 * behaved, for the same reason, and it is worth not losing by accident.
 */
export const upsertExercises = async (
    client: SupabaseClient,
    rows: SeededExercise[],
): Promise<number> => {
    // Milliseconds. D1 stored seconds because SQLite has no ON UPDATE and the
    // seeder wrote the value itself; every `*_at` column in this Postgres schema
    // is Unix milliseconds, as `supabase/migrations/0001` established.
    const now = Date.now();

    return client.upsert(
        'catalogue_exercises',
        rows.map(({ entry, asset }) => ({
            id: entry.id,
            gif_filename: entry.gifFilename,
            name: entry.name,
            category: entry.category,
            // Real arrays now. D1 stored these as TEXT and the Worker parsed
            // them back on every read.
            equipment: entry.equipment,
            primary_muscle_groups: entry.primaryMuscleGroups,
            secondary_muscle_groups: entry.secondaryMuscleGroups,
            cloudinary_public_id: asset.publicId,
            cloudinary_version: asset.version,
            secure_url: asset.secureUrl,
            width: asset.width,
            height: asset.height,
            bytes: asset.bytes,
            updated_at: now,
        })),
        'id',
    );
};

/** Everything a locale can override for one exercise. */
export interface LocaleText {
    steps: string[];
    /**
     * The exercise's name in this locale. English leaves it undefined so
     * `catalogue_page` falls through to `catalogue_exercises.name`, which is the
     * only name the dataset ships.
     */
    name?: string;
}

export type InstructionsByLocale = Map<Locale, Map<string, LocaleText>>;

/**
 * Upserts per-locale text, one row per (exercise, locale).
 *
 * A locale with neither steps nor a name writes no row at all. One with a name
 * but no steps writes `[]`, which `catalogue_page` degrades to the English steps
 * exactly as a missing row would — so "not translated" and "translated to
 * nothing" still behave the same, and a name can arrive without one.
 */
export const upsertInstructions = async (
    client: SupabaseClient,
    instructions: InstructionsByLocale,
): Promise<number> => {
    const rows: Record<string, unknown>[] = [];

    for (const locale of LOCALES) {
        const perExercise = instructions.get(locale);
        if (!perExercise) continue;

        for (const [exerciseId, text] of perExercise) {
            if (text.steps.length === 0 && !text.name) continue;

            rows.push({
                exercise_id: exerciseId,
                locale,
                steps: text.steps,
                name: text.name ?? null,
            });
        }
    }

    return client.upsert('catalogue_instructions', rows, 'exercise_id,locale');
};

export const countExercises = async (client: SupabaseClient): Promise<number> =>
    client.count('catalogue_exercises');
