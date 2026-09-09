import { request } from './supabase.ts';
import type { Env, ExerciseInput, ExerciseRow } from './types.ts';

/**
 * The write side of the exercise catalogue.
 *
 * This used to be raw prepared statements against Cloudflare D1, with the
 * WHERE clause and its `?1`-style bindings assembled by hand. The catalogue is
 * in Postgres now and reached through PostgREST, so the queries below are query
 * strings rather than SQL — which also means the app's read path
 * (`catalogue_page`) and this write path finally share one database.
 *
 * `supabase/migrations/0003` gives these tables a read policy and no write
 * policy at all, so nothing here works without the service-role key. That is
 * the intended arrangement: the catalogue is public to read and writable only
 * by this dashboard and the seeder.
 */

const PAGE_SIZE = 50;

/** Unix milliseconds, matching every other `*_at` column. D1 stored seconds. */
const nowMs = () => Date.now();

const SELECT_COLUMNS =
    'id,name,category,gif_filename,equipment,primary_muscle_groups,' +
    'secondary_muscle_groups,is_active,secure_url,updated_at';

/**
 * Reads a list column.
 *
 * On D1 these were TEXT holding JSON and every caller had to parse them. In
 * Postgres they are `jsonb` and arrive as real arrays, so the common case is
 * now a pass-through. The string branch is kept because a hand-edited row, or
 * an older export being re-imported, can still present one — and a comma list
 * is the obvious thing a person types, so it is read rather than rejected.
 */
export const parseList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== 'string' || value.length === 0) return [];

    try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
        // Not JSON. Fall through to the comma list below.
    }

    return value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
};

/** Accepts what a text input gives us — one per line, or comma-separated. */
export const toList = (value: string): string[] =>
    value
        .split(/[\n,]/)
        .map((part) => part.trim())
        .filter(Boolean);

/**
 * PostgREST treats `,` `.` `(` `)` and `"` as syntax inside a filter value, so
 * anything typed into the search box is wrapped in double quotes and its own
 * quotes escaped. Without this a search for "row, seated" would be read as two
 * filter arguments.
 */
const quote = (value: string): string => `"${value.replace(/"/g, '\\"')}"`;

export type StatusFilter = 'all' | 'active' | 'inactive';

export interface ListOptions {
    search: string;
    category: string;
    status: StatusFilter;
    cursor: string | null;
}

export interface ListResult {
    items: ExerciseRow[];
    nextCursor: string | null;
}

export const listExercises = async (env: Env, options: ListOptions): Promise<ListResult> => {
    const filters = [
        `select=${SELECT_COLUMNS}`,
        'order=id.asc',
        // One row over the page, so "is there a next page" is answered without
        // a second count over a filtered scan.
        `limit=${PAGE_SIZE + 1}`,
    ];

    // `ilike` is Postgres's case-insensitive LIKE; `*` is PostgREST's wildcard.
    if (options.search) filters.push(`name=ilike.${quote(`*${options.search}*`)}`);
    if (options.category) filters.push(`category=eq.${quote(options.category)}`);
    if (options.status === 'active') filters.push('is_active=is.true');
    if (options.status === 'inactive') filters.push('is_active=is.false');
    // Keyset pagination on the primary key, the same as the app's read path.
    if (options.cursor) filters.push(`id=gt.${quote(options.cursor)}`);

    const rows = await request<ExerciseRow[]>(env, `catalogue_exercises?${filters.join('&')}`);
    const items = rows.slice(0, PAGE_SIZE);
    const nextCursor = rows.length > PAGE_SIZE ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
};

/**
 * Active and inactive totals.
 *
 * Two counting requests rather than one aggregate: PostgREST reports an exact
 * count in the `content-range` header, and asking for zero rows twice is
 * cheaper and far plainer than depending on aggregate support being enabled on
 * the project.
 */
export const countByStatus = async (env: Env): Promise<{ active: number; inactive: number }> => {
    const [active, inactive] = await Promise.all([
        request<number>(env, 'catalogue_exercises?select=id&is_active=is.true', { count: true }),
        request<number>(env, 'catalogue_exercises?select=id&is_active=is.false', { count: true }),
    ]);

    return { active, inactive };
};

export const getExercise = async (env: Env, id: string): Promise<ExerciseRow | null> => {
    const rows = await request<ExerciseRow[]>(
        env,
        `catalogue_exercises?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    );

    return rows[0] ?? null;
};

/**
 * Creates a catalogue row with empty media.
 *
 * The media columns default to empty in `0003` precisely so this can omit them:
 * the real values come from Cloudinary by way of the seeder, and asking an
 * admin to paste a public id and a byte count would be a strange thing to
 * require. A blank `secure_url` renders as no animation in the app, which is
 * already how an unconfigured media host behaves.
 */
export const createExercise = async (env: Env, input: ExerciseInput): Promise<void> => {
    await request(env, 'catalogue_exercises', {
        method: 'POST',
        returning: false,
        body: {
            id: input.id,
            gif_filename: input.gifFilename,
            name: input.name,
            category: input.category,
            equipment: input.equipment,
            primary_muscle_groups: input.primaryMuscleGroups,
            secondary_muscle_groups: input.secondaryMuscleGroups,
            is_active: input.isActive,
            updated_at: nowMs(),
        },
    });
};

export const updateExercise = async (env: Env, input: ExerciseInput): Promise<void> => {
    await request(env, `catalogue_exercises?id=eq.${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        returning: false,
        body: {
            name: input.name,
            category: input.category,
            gif_filename: input.gifFilename,
            equipment: input.equipment,
            primary_muscle_groups: input.primaryMuscleGroups,
            secondary_muscle_groups: input.secondaryMuscleGroups,
            is_active: input.isActive,
            updated_at: nowMs(),
        },
    });
};

export const setExerciseActive = async (env: Env, id: string, active: boolean): Promise<void> => {
    await request(env, `catalogue_exercises?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        returning: false,
        body: { is_active: active, updated_at: nowMs() },
    });
};

/**
 * Removes the row and its translations together.
 *
 * One statement now. On D1 this was a two-statement batch, because D1 had no
 * foreign keys and orphaned `exercise_instruction` rows would otherwise
 * accumulate and reattach to any future exercise that reused the id. `0003`
 * declares `on delete cascade`, so the database does it.
 */
export const deleteExercise = async (env: Env, id: string): Promise<void> => {
    await request(env, `catalogue_exercises?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        returning: false,
    });
};

/**
 * The categories actually in use, for the filter and the form's dropdown.
 *
 * A function rather than a query, because PostgREST cannot express
 * `select distinct` and fetching 1,324 rows to collect a handful of strings
 * would be a silly way to fill a select box.
 */
export const listCategories = async (env: Env): Promise<string[]> => {
    const rows = await request<{ category: string }[]>(env, 'rpc/catalogue_categories');

    return rows.map((row) => row.category);
};
