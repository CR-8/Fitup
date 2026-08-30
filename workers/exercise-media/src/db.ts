import { DEFAULT_LOCALE, type Env, type ExerciseItem, type Locale, type Page } from './types';

/** Page size bounds. 100 keeps a single response comfortably under the cache's item limit. */
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 50;

export const clampLimit = (raw: string | null): number => {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return DEFAULT_LIMIT;

    return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
};

/**
 * D1 stores the JSON columns as TEXT, so they arrive as strings. This still
 * accepts an array as well: the column is JSON by intent, and a value that has
 * already been parsed should not be a failure. A malformed value degrades to an
 * empty list rather than a 500 — one bad row should not take out a whole page.
 */
const asStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
        try {
            return asStringArray(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return [];
};

interface Row {
    id: string;
    name: string;
    category: string;
    equipment: unknown;
    primary_muscle_groups: unknown;
    secondary_muscle_groups: unknown;
    gif_filename: string;
    secure_url: string;
    width: number;
    height: number;
    steps: unknown;
    fallback_steps: unknown;
}

const toItem = (row: Row): ExerciseItem => {
    const steps = asStringArray(row.steps);

    return {
        id: row.id,
        name: row.name,
        category: row.category,
        equipment: asStringArray(row.equipment),
        primaryMuscleGroups: asStringArray(row.primary_muscle_groups),
        secondaryMuscleGroups: asStringArray(row.secondary_muscle_groups),
        gifFilename: row.gif_filename,
        secureUrl: row.secure_url,
        width: row.width,
        height: row.height,
        // A locale that has not been translated falls back to English rather
        // than returning an exercise with no instructions at all.
        instructions: steps.length > 0 ? steps : asStringArray(row.fallback_steps),
    };
};

/**
 * One page of the catalogue, ordered by id.
 *
 * Keyset pagination, never OFFSET: `OFFSET 1200` makes SQLite walk and discard
 * 1,200 rows before returning anything, so the last page of a catalogue costs
 * far more than the first. `WHERE id > ?` costs the same at every depth.
 *
 * `limit + 1` rows are fetched so the extra row proves whether another page
 * exists, which is cheaper than a second COUNT(*) over the table.
 */
export const fetchPage = async (
    env: Env,
    { cursor, limit, locale }: { cursor: string | null; limit: number; locale: Locale },
): Promise<Page> => {
    const sql = `SELECT
            e.id, e.name, e.category, e.equipment,
            e.primary_muscle_groups, e.secondary_muscle_groups,
            e.gif_filename, e.secure_url, e.width, e.height,
            i.steps AS steps,
            f.steps AS fallback_steps
         FROM exercise e
         LEFT JOIN exercise_instruction i ON i.exercise_id = e.id AND i.locale = ?
         LEFT JOIN exercise_instruction f ON f.exercise_id = e.id AND f.locale = ?
         ${cursor ? 'WHERE e.id > ?' : ''}
         ORDER BY e.id ASC
         LIMIT ?`;

    const params: (string | number)[] = cursor
        ? [locale, DEFAULT_LOCALE, cursor, limit + 1]
        : [locale, DEFAULT_LOCALE, limit + 1];

    const { results } = await env.DB.prepare(sql)
        .bind(...params)
        .all<Row>();

    const rows = results ?? [];
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toItem);

    return {
        items,
        hasMore,
        nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
};

export const ping = async (env: Env): Promise<number> => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM exercise').first<{
        total: number;
    }>();

    return Number(row?.total ?? 0);
};
