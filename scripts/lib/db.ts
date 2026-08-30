import { LOCALES, type CatalogueEntry, type Locale } from './dataset';
import type { UploadedAsset } from './cloudinary';
import { runPool } from './limiter';

/**
 * Cloudflare D1 writes for the seed run, over the REST API.
 *
 * The Worker reaches D1 through a binding, which only exists inside the Workers
 * runtime. A local script has to go through the HTTP API instead, which needs
 * an account id, a database id and a token rather than a connection string.
 *
 * Batch sizes here are not a tuning choice. D1 caps a query at **100 bound
 * parameters**, so the number of rows per statement is fixed by how many columns
 * each row binds. Exceeding it fails at runtime, in the middle of a seed run.
 * https://developers.cloudflare.com/d1/platform/limits/
 */

const D1_MAX_BOUND_PARAMS = 100;

const EXERCISE_COLUMNS = 14;
const INSTRUCTION_COLUMNS = 3;

/** 7 rows x 14 columns = 98 parameters. */
const EXERCISE_BATCH_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / EXERCISE_COLUMNS);

/** 33 rows x 3 columns = 99 parameters. */
const INSTRUCTION_BATCH_SIZE = Math.floor(D1_MAX_BOUND_PARAMS / INSTRUCTION_COLUMNS);

/**
 * Statements in flight. The cap is small enough that a full seed is ~390
 * requests; without concurrency that is ~390 sequential round trips.
 */
const REQUEST_CONCURRENCY = 8;

export class DatabaseNotConfiguredError extends Error {
    constructor(missing: string[]) {
        super(
            `Missing ${missing.join(', ')}. Copy .env.example to .env.local and fill them in.\n` +
                'API token:   My Profile > API Tokens > Create Token > Custom, with\n' +
                '             Account > D1 > Edit.\n' +
                'Database id: printed by `wrangler d1 create fitup-exercises`.\n' +
                'Account id:  optional — resolved from the token when only one account\n' +
                '             is in scope. Otherwise take it from the dashboard URL:\n' +
                '             https://dash.cloudflare.com/<account-id>/workers',
        );
        this.name = 'DatabaseNotConfiguredError';
    }
}

/**
 * Resolves the account id from the token when it was not supplied.
 *
 * The account id is not a secret and not a choice — a token already belongs to
 * exactly one account in the common case, so asking someone to go and find a
 * 32-character hex string in a dashboard URL is a step that does not need to
 * exist. It is only ambiguous when a token spans several accounts, and then the
 * error names them rather than guessing.
 */
const resolveAccountId = async (token: string): Promise<string> => {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: { authorization: `Bearer ${token}` },
    });

    const body = (await response.json()) as {
        success: boolean;
        errors?: { code: number; message: string }[];
        result?: { id: string; name: string }[];
    };

    if (!response.ok || !body.success) {
        const detail =
            body.errors?.map((error) => `${error.code} ${error.message}`).join('; ') ??
            `${response.status} ${response.statusText}`;

        throw new Error(
            `Could not resolve the account id from the token (${detail}).\n` +
                'Set CLOUDFLARE_ACCOUNT_ID in .env.local instead — it is the hex segment in\n' +
                'the dashboard URL: https://dash.cloudflare.com/<account-id>/workers',
        );
    }

    const accounts = body.result ?? [];

    if (accounts.length === 0) {
        throw new Error('That token has no accounts in scope. Check it was created correctly.');
    }

    if (accounts.length > 1) {
        const listed = accounts.map((a) => `  ${a.id}  ${a.name}`).join('\n');
        throw new Error(
            `The token spans ${accounts.length} accounts. Set CLOUDFLARE_ACCOUNT_ID to one of:\n${listed}`,
        );
    }

    console.log(`  account: ${accounts[0].name} (${accounts[0].id})`);

    return accounts[0].id;
};

interface D1Response {
    success: boolean;
    errors: { code: number; message: string }[];
    result: { success: boolean; meta?: { rows_written?: number } }[];
}

export interface D1Client {
    query: (sql: string, params: unknown[]) => Promise<D1Response>;
}

export const connect = async (): Promise<D1Client> => {
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

    const missing = [
        !databaseId && 'CLOUDFLARE_D1_DATABASE_ID',
        !token && 'CLOUDFLARE_API_TOKEN',
    ].filter((value): value is string => typeof value === 'string');

    if (missing.length > 0) throw new DatabaseNotConfiguredError(missing);

    const accountId =
        process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || (await resolveAccountId(token as string));

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

    return {
        query: async (sql, params) => {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ sql, params }),
            });

            const body = (await response.json()) as D1Response;

            if (!response.ok || !body.success) {
                const detail =
                    body.errors?.map((error) => `${error.code} ${error.message}`).join('; ') ??
                    `${response.status} ${response.statusText}`;

                throw new Error(`D1 query failed: ${detail}`);
            }

            return body;
        },
    };
};

const chunk = <T>(values: T[], size: number): T[][] => {
    const batches: T[][] = [];

    for (let index = 0; index < values.length; index += size) {
        batches.push(values.slice(index, index + size));
    }

    return batches;
};

/** `VALUES (?,?,…),(?,?,…)` for `rows` rows of `columns` columns. */
const placeholders = (rows: number, columns: number): string =>
    Array.from({ length: rows }, () => `(${Array(columns).fill('?').join(',')})`).join(',');

export interface SeededExercise {
    entry: CatalogueEntry;
    asset: UploadedAsset;
}

/**
 * Upserts catalogue rows.
 *
 * `ON CONFLICT DO UPDATE` rather than `INSERT OR REPLACE`: REPLACE deletes and
 * reinserts, which in SQLite fires delete triggers and would break any future
 * foreign key pointing at these ids.
 */
export const upsertExercises = async (
    client: D1Client,
    rows: SeededExercise[],
): Promise<number> => {
    const now = Math.floor(Date.now() / 1000);
    const batches = chunk(rows, EXERCISE_BATCH_SIZE);

    await runPool(batches, REQUEST_CONCURRENCY, async (batch) => {
        const params = batch.flatMap(({ entry, asset }) => [
            entry.id,
            entry.gifFilename,
            entry.name,
            entry.category,
            JSON.stringify(entry.equipment),
            JSON.stringify(entry.primaryMuscleGroups),
            JSON.stringify(entry.secondaryMuscleGroups),
            asset.publicId,
            asset.version,
            asset.secureUrl,
            asset.width,
            asset.height,
            asset.bytes,
            now,
        ]);

        await client.query(
            `INSERT INTO exercise (
                id, gif_filename, name, category,
                equipment, primary_muscle_groups, secondary_muscle_groups,
                cloudinary_public_id, cloudinary_version, secure_url,
                width, height, bytes, updated_at
             ) VALUES ${placeholders(batch.length, EXERCISE_COLUMNS)}
             ON CONFLICT(id) DO UPDATE SET
                gif_filename = excluded.gif_filename,
                name = excluded.name,
                category = excluded.category,
                equipment = excluded.equipment,
                primary_muscle_groups = excluded.primary_muscle_groups,
                secondary_muscle_groups = excluded.secondary_muscle_groups,
                cloudinary_public_id = excluded.cloudinary_public_id,
                cloudinary_version = excluded.cloudinary_version,
                secure_url = excluded.secure_url,
                width = excluded.width,
                height = excluded.height,
                bytes = excluded.bytes,
                updated_at = excluded.updated_at`,
            params,
        );
    });

    return rows.length;
};

export type InstructionsByLocale = Map<Locale, Map<string, string[]>>;

/**
 * Upserts instruction text, one row per (exercise, locale).
 *
 * A locale with no steps for an exercise writes no row at all rather than an
 * empty array, so the Worker's LEFT JOIN can tell "not translated" from
 * "translated to nothing" and fall back to English.
 */
export const upsertInstructions = async (
    client: D1Client,
    instructions: InstructionsByLocale,
): Promise<number> => {
    const rows: [string, string, string][] = [];

    for (const locale of LOCALES) {
        const perExercise = instructions.get(locale);
        if (!perExercise) continue;

        for (const [exerciseId, steps] of perExercise) {
            if (steps.length > 0) rows.push([exerciseId, locale, JSON.stringify(steps)]);
        }
    }

    const batches = chunk(rows, INSTRUCTION_BATCH_SIZE);

    await runPool(batches, REQUEST_CONCURRENCY, async (batch) => {
        await client.query(
            `INSERT INTO exercise_instruction (exercise_id, locale, steps)
             VALUES ${placeholders(batch.length, INSTRUCTION_COLUMNS)}
             ON CONFLICT(exercise_id, locale) DO UPDATE SET steps = excluded.steps`,
            batch.flat(),
        );
    });

    return rows.length;
};

export const countExercises = async (client: D1Client): Promise<number> => {
    const body = await client.query('SELECT COUNT(*) AS total FROM exercise', []);
    const results = (body.result[0] as { results?: { total?: number }[] })?.results;

    return Number(results?.[0]?.total ?? 0);
};
