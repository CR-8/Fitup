import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { loadEnvFiles } from './lib/env';
import { connectSupabase } from './lib/supabase';

/**
 * Moves the exercise catalogue from Cloudflare D1 to Supabase. Runs once.
 *
 *   bun run migrate:catalogue -- --dry-run   read and transform, write nothing
 *   bun run migrate:catalogue                read, dump, transform, load, verify
 *
 * This is the only step in the migration that still touches Cloudflare, and it
 * is unavoidable: the data has to come out of D1 before D1 can be deleted.
 *
 * It carries its own D1 client rather than importing `lib/db.ts`, which is
 * being rewritten to talk to Supabase. Keeping the read side self-contained is
 * what lets that rewrite happen without this script caring, and lets both be
 * deleted together once the cutover is done.
 *
 * The raw D1 response is written to disk *before* anything is transformed. Once
 * the D1 database is deleted that dump is the only rollback there is, and at
 * ~1.5 MB it costs nothing to keep.
 */

/** Under `.cache/`, which is already gitignored and already holds the seed ledger. */
const DUMP_DIR = '.cache/migration';

/** D1 rows per request. The whole catalogue is small; this is 3 round trips. */
const READ_PAGE = 1000;

interface D1Exercise {
    id: string;
    gif_filename: string;
    name: string;
    category: string;
    equipment: string;
    primary_muscle_groups: string;
    secondary_muscle_groups: string;
    cloudinary_public_id: string;
    cloudinary_version: number;
    secure_url: string;
    width: number;
    height: number;
    bytes: number;
    is_active: number;
    updated_at: number;
}

interface D1Instruction {
    exercise_id: string;
    locale: string;
    steps: string;
    name: string | null;
}

/* -------------------------------------------------------------------------- */
/* Reading D1                                                                 */
/* -------------------------------------------------------------------------- */

const d1Query = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!databaseId || !token) {
        throw new Error(
            'Missing CLOUDFLARE_D1_DATABASE_ID or CLOUDFLARE_API_TOKEN in .env.local.\n' +
                'They are still needed for this one script, which is the last thing that\n' +
                'reads Cloudflare. Both can be deleted once the migration is verified.',
        );
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || (await resolveAccountId(token));

    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ sql, params }),
        },
    );

    const body = (await response.json()) as {
        success: boolean;
        errors?: { code: number; message: string }[];
        result?: { results?: T[] }[];
    };

    if (!response.ok || !body.success) {
        const detail =
            body.errors?.map((error) => `${error.code} ${error.message}`).join('; ') ??
            `${response.status} ${response.statusText}`;

        throw new Error(`D1 query failed: ${detail}`);
    }

    return body.result?.[0]?.results ?? [];
};

/** Cached, so paging does not re-resolve the account on every request. */
let cachedAccountId: string | null = null;

const resolveAccountId = async (token: string): Promise<string> => {
    if (cachedAccountId) return cachedAccountId;

    const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: { authorization: `Bearer ${token}` },
    });

    const body = (await response.json()) as {
        success: boolean;
        result?: { id: string; name: string }[];
    };

    const accounts = body.result ?? [];

    if (!body.success || accounts.length !== 1) {
        throw new Error(
            `Could not resolve a single Cloudflare account (${accounts.length} in scope).\n` +
                'Set CLOUDFLARE_ACCOUNT_ID in .env.local.',
        );
    }

    cachedAccountId = accounts[0].id;

    return cachedAccountId;
};

/** Pages a table out in id order. OFFSET is fine here: this runs once, on 4k rows. */
const readAll = async <T>(table: string, order: string): Promise<T[]> => {
    const rows: T[] = [];

    for (let offset = 0; ; offset += READ_PAGE) {
        const page = await d1Query<T>(
            `SELECT * FROM ${table} ORDER BY ${order} LIMIT ? OFFSET ?`,
            [READ_PAGE, offset],
        );

        rows.push(...page);
        process.stdout.write(`\r  ${table}: ${rows.length} rows`);

        if (page.length < READ_PAGE) break;
    }

    process.stdout.write('\n');

    return rows;
};

/* -------------------------------------------------------------------------- */
/* Transform                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * D1 stored the JSON columns as TEXT. Postgres wants real arrays.
 *
 * Deliberately strict, unlike the Worker's `asStringArray`, which degraded a
 * malformed value to an empty list so one bad row could not take out a page.
 * That was right for a read path serving live traffic. This is a migration: a
 * value that will not parse means the data is not what the audit found, and
 * silently writing `[]` would lose it for good.
 */
const parseJsonArray = (value: string, where: string): string[] => {
    let parsed: unknown;

    try {
        parsed = JSON.parse(value);
    } catch {
        throw new Error(`${where}: not valid JSON -- ${value.slice(0, 120)}`);
    }

    if (!Array.isArray(parsed)) throw new Error(`${where}: expected an array`);

    return parsed.map(String);
};

const toExerciseRow = (row: D1Exercise) => ({
    id: row.id,
    gif_filename: row.gif_filename,
    name: row.name,
    category: row.category,
    equipment: parseJsonArray(row.equipment, `${row.id}.equipment`),
    primary_muscle_groups: parseJsonArray(
        row.primary_muscle_groups,
        `${row.id}.primary_muscle_groups`,
    ),
    secondary_muscle_groups: parseJsonArray(
        row.secondary_muscle_groups,
        `${row.id}.secondary_muscle_groups`,
    ),
    cloudinary_public_id: row.cloudinary_public_id,
    cloudinary_version: row.cloudinary_version,
    secure_url: row.secure_url,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    is_active: row.is_active === 1,
    // D1 held Unix seconds; every `*_at` in this Postgres schema is milliseconds.
    updated_at: row.updated_at * 1000,
});

const toInstructionRow = (row: D1Instruction) => ({
    exercise_id: row.exercise_id,
    locale: row.locale,
    steps: parseJsonArray(row.steps, `${row.exercise_id}/${row.locale}.steps`),
    name: row.name,
});

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const migrate = async () => {
    loadEnvFiles();

    const dryRun = process.argv.includes('--dry-run');

    console.log('Reading Cloudflare D1…');
    const exercises = await readAll<D1Exercise>('exercise', 'id');
    const instructions = await readAll<D1Instruction>('exercise_instruction', 'exercise_id, locale');

    // Before the transform, and before anything is written to Supabase. Once D1
    // is deleted this file is the only way back.
    const dumpPath = `${DUMP_DIR}/d1-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await mkdir(dirname(dumpPath), { recursive: true });
    await writeFile(dumpPath, JSON.stringify({ exercises, instructions }, null, 2));
    console.log(`\nDumped raw D1 rows to ${dumpPath}`);

    const byLocale = instructions.reduce<Record<string, number>>((counts, row) => {
        counts[row.locale] = (counts[row.locale] ?? 0) + 1;
        return counts;
    }, {});

    console.log(`  exercises:    ${exercises.length}`);
    console.log(`  instructions: ${instructions.length}  ${JSON.stringify(byLocale)}`);

    console.log('\nTransforming…');
    const exerciseRows = exercises.map(toExerciseRow);
    const instructionRows = instructions.map(toInstructionRow);
    const inactive = exerciseRows.filter((row) => !row.is_active).length;
    console.log(`  ${exerciseRows.length} exercises (${inactive} inactive)`);
    console.log(`  ${instructionRows.length} instruction rows`);

    if (dryRun) {
        console.log('\n--dry-run: nothing written.');
        console.log('Sample exercise:', JSON.stringify(exerciseRows[0], null, 2).slice(0, 500));
        return;
    }

    const supabase = connectSupabase();

    // Parents first: `catalogue_instructions.exercise_id` has a foreign key, so
    // loading them the other way round would be rejected row by row.
    console.log('\nLoading catalogue_exercises…');
    await supabase.upsert('catalogue_exercises', exerciseRows, 'id');

    console.log('Loading catalogue_instructions…');
    await supabase.upsert('catalogue_instructions', instructionRows, 'exercise_id,locale');

    console.log('\nVerifying…');
    const exerciseCount = await supabase.count('catalogue_exercises');
    const instructionCount = await supabase.count('catalogue_instructions');

    const ok =
        exerciseCount === exercises.length && instructionCount === instructions.length;

    console.log(`  catalogue_exercises:    ${exerciseCount} / ${exercises.length}`);
    console.log(`  catalogue_instructions: ${instructionCount} / ${instructions.length}`);

    // The read path, exercised exactly as the app will call it. `catalogue_page`
    // returns one jsonb envelope, not a row set, so this is an object rather
    // than an array.
    const page = await supabase.selectOne<{
        items: { id: string; name: string; nameEn: string }[];
    }>('rpc/catalogue_page?p_locale=hi&p_limit=1');
    const first = page?.items?.[0];
    console.log(
        `  catalogue_page(hi):     ${first ? `${first.name} (en: ${first.nameEn})` : 'NO ITEMS'}`,
    );

    if (!ok) {
        throw new Error('Row counts do not match. The dump above is intact; do not delete D1.');
    }

    console.log('\nDone. Counts match.');
};

migrate().catch((error) => {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
