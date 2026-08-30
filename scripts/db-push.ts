import { readFile } from 'node:fs/promises';

import { connect } from './lib/db';
import { loadEnvFiles } from './lib/env';

/**
 * Applies workers/exercise-media/schema.sql to Cloudflare D1.
 *
 *   bun run db:push
 *
 * Every statement is CREATE TABLE IF NOT EXISTS, so this is safe to re-run. It
 * deliberately does not drop or alter anything: a schema change that needs to
 * destroy data should be a deliberate, reviewed migration, not a side effect of
 * the command people run most often.
 */

const SCHEMA_PATH = new URL('../workers/exercise-media/schema.sql', import.meta.url);

/** Strips comments and splits on `;`, which is enough for a file of CREATE TABLEs. */
const statementsOf = (sql: string): string[] =>
    sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);

const push = async () => {
    loadEnvFiles();

    const sql = await readFile(SCHEMA_PATH, 'utf8');
    const statements = statementsOf(sql);

    console.log(`Applying ${statements.length} statement(s) to D1…`);

    const client = await connect();

    for (const statement of statements) {
        const name = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1] ?? 'statement';
        await client.query(statement, []);
        console.log(`  ${name}`);
    }

    const body = await client.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        [],
    );
    const tables = (body.result[0] as { results?: { name: string }[] })?.results ?? [];

    console.log(`\nTables now present: ${tables.length}`);
    for (const table of tables) console.log(`  ${table.name}`);
};

push().catch((error) => {
    console.error('\nSchema push failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
