import { connect } from './lib/db';
import { loadEnvFiles } from './lib/env';

/**
 * Adds `exercise.is_active` to an already-deployed D1 database.
 *
 *   bun run d1:add-is-active
 *
 * `schema.sql` carries the column too, so a database created from scratch never
 * needs this. It exists because `db-push.ts` runs only statements that are safe
 * to repeat, and `ALTER TABLE ... ADD COLUMN` is not one of them: SQLite has no
 * `IF NOT EXISTS` for it and errors with "duplicate column name" on the second
 * run. So the check happens here, once, deliberately.
 *
 * `NOT NULL DEFAULT 1` rewrites no rows and loses nothing: every existing
 * exercise reads back active, which is what the catalogue has always behaved
 * like. The column is written by workers/cms and read only there — the
 * catalogue endpoint still serves every row, so applying this changes nothing
 * any installed app can observe.
 */

const COLUMN = 'is_active';
const TABLE = 'exercise';

interface ColumnInfo {
    name: string;
}

const migrate = async () => {
    loadEnvFiles();

    const client = await connect();

    const body = await client.query(`PRAGMA table_info(${TABLE})`, []);
    const columns = (body.result[0] as { results?: ColumnInfo[] })?.results ?? [];

    if (columns.length === 0) {
        throw new Error(`${TABLE} does not exist. Run \`bun run db:push\` first.`);
    }

    if (columns.some((column) => column.name === COLUMN)) {
        console.log(`${TABLE}.${COLUMN} is already present. Nothing to do.`);

        return;
    }

    await client.query(
        `ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} INTEGER NOT NULL DEFAULT 1`,
        [],
    );
    console.log(`Added ${TABLE}.${COLUMN}. Every existing row reads as active.`);
};

migrate().catch((error) => {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
