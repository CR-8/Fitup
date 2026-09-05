import type { Env, ExerciseInput, ExerciseRow } from './types';

/**
 * The write side of the exercise catalogue on D1.
 *
 * `workers/exercise-media` reads this same database and only ever SELECTs; this
 * is where rows are edited. Raw prepared statements rather than an ORM, for the
 * same reason the sibling Worker routes with a switch: a Worker pays for every
 * kilobyte of bundle on cold start, and six queries against one table do not
 * repay a schema mirror and a build step.
 *
 * Every value reaching SQL is a bound parameter. The only interpolated fragments
 * are built from a fixed allow-list below, never from request input.
 */

const PAGE_SIZE = 50;

/** Unix *seconds*: D1 has no ON UPDATE, so the writer sets this explicitly. */
const nowSeconds = () => Math.floor(Date.now() / 1000);

const asJsonArray = (value: string): string[] => {
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        // The seeder writes JSON, but a hand-edited row might not be. A comma
        // list is the obvious human fallback, so read it rather than throwing.
        return value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
    }
};

export const parseList = (value: string): string[] => (value ? asJsonArray(value) : []);

/** Accepts what a text input gives us — one per line, or comma-separated. */
export const toList = (value: string): string[] =>
    value
        .split(/[\n,]/)
        .map((part) => part.trim())
        .filter(Boolean);

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

const SELECT_COLUMNS = `
    id, name, category, gif_filename, equipment,
    primary_muscle_groups, secondary_muscle_groups,
    is_active, secure_url, updated_at
`;

export const listExercises = async (env: Env, options: ListOptions): Promise<ListResult> => {
    const where: string[] = [];
    const bindings: unknown[] = [];

    if (options.search) {
        // SQLite's LIKE is already case-insensitive for ASCII.
        where.push('name LIKE ?1');
        bindings.push(`%${options.search}%`);
    }

    if (options.category) {
        where.push(`category = ?${bindings.length + 1}`);
        bindings.push(options.category);
    }

    if (options.status === 'active') where.push('is_active = 1');
    if (options.status === 'inactive') where.push('is_active = 0');

    if (options.cursor) {
        where.push(`id > ?${bindings.length + 1}`);
        bindings.push(options.cursor);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // One row over the page, so "is there a next page" is answered without a
    // second COUNT query over a filtered scan.
    const statement = env.DB.prepare(
        `SELECT ${SELECT_COLUMNS} FROM exercise ${clause} ORDER BY id LIMIT ${PAGE_SIZE + 1}`,
    ).bind(...bindings);

    const { results } = await statement.all<ExerciseRow>();
    const rows = results ?? [];
    const items = rows.slice(0, PAGE_SIZE);
    const nextCursor = rows.length > PAGE_SIZE ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
};

export const countByStatus = async (env: Env): Promise<{ active: number; inactive: number }> => {
    const row = await env.DB.prepare(
        `SELECT
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive
         FROM exercise`,
    ).first<{ active: number | null; inactive: number | null }>();

    return { active: row?.active ?? 0, inactive: row?.inactive ?? 0 };
};

export const getExercise = async (env: Env, id: string): Promise<ExerciseRow | null> =>
    env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM exercise WHERE id = ?1`)
        .bind(id)
        .first<ExerciseRow>();

/**
 * Creates a catalogue row with empty media.
 *
 * Every media column is NOT NULL, and the values normally come from Cloudinary
 * by way of the seeder. Rather than ask an admin to paste a public id and a
 * byte count, they start blank and `bun run seed` fills them in. A blank
 * `secure_url` renders as no animation in the app, which is already how an
 * unconfigured media host behaves.
 */
export const createExercise = async (env: Env, input: ExerciseInput): Promise<void> => {
    await env.DB.prepare(
        `INSERT INTO exercise (
            id, gif_filename, name, category, equipment,
            primary_muscle_groups, secondary_muscle_groups,
            cloudinary_public_id, cloudinary_version, secure_url,
            width, height, bytes, is_active, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '', 0, '', 0, 0, 0, ?8, ?9)`,
    )
        .bind(
            input.id,
            input.gifFilename,
            input.name,
            input.category,
            JSON.stringify(input.equipment),
            JSON.stringify(input.primaryMuscleGroups),
            JSON.stringify(input.secondaryMuscleGroups),
            input.isActive ? 1 : 0,
            nowSeconds(),
        )
        .run();
};

export const updateExercise = async (env: Env, input: ExerciseInput): Promise<void> => {
    await env.DB.prepare(
        `UPDATE exercise SET
            name = ?2, category = ?3, gif_filename = ?4, equipment = ?5,
            primary_muscle_groups = ?6, secondary_muscle_groups = ?7,
            is_active = ?8, updated_at = ?9
         WHERE id = ?1`,
    )
        .bind(
            input.id,
            input.name,
            input.category,
            input.gifFilename,
            JSON.stringify(input.equipment),
            JSON.stringify(input.primaryMuscleGroups),
            JSON.stringify(input.secondaryMuscleGroups),
            input.isActive ? 1 : 0,
            nowSeconds(),
        )
        .run();
};

export const setExerciseActive = async (env: Env, id: string, active: boolean): Promise<void> => {
    await env.DB.prepare(`UPDATE exercise SET is_active = ?2, updated_at = ?3 WHERE id = ?1`)
        .bind(id, active ? 1 : 0, nowSeconds())
        .run();
};

/**
 * Removes the row and its translations together.
 *
 * D1 has no foreign keys here, so orphaned `exercise_instruction` rows would
 * simply accumulate and then reattach to any future exercise that reused the id.
 * Batched so the two either both land or neither does.
 */
export const deleteExercise = async (env: Env, id: string): Promise<void> => {
    await env.DB.batch([
        env.DB.prepare('DELETE FROM exercise_instruction WHERE exercise_id = ?1').bind(id),
        env.DB.prepare('DELETE FROM exercise WHERE id = ?1').bind(id),
    ]);
};

export const listCategories = async (env: Env): Promise<string[]> => {
    const { results } = await env.DB.prepare(
        'SELECT DISTINCT category FROM exercise ORDER BY category',
    ).all<{ category: string }>();

    return (results ?? []).map((row) => row.category);
};
