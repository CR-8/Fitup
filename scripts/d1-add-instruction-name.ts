import { connect } from './lib/db';
import { loadEnvFiles } from './lib/env';

/**
 * Adds `exercise_instruction.name` to an already-deployed D1 database.
 *
 *   bun run d1:add-instruction-name
 *
 * `schema.sql` carries the column too, so a database created from scratch never
 * needs this. It exists because `db-push.ts` runs only statements that are safe
 * to repeat, and `ALTER TABLE ... ADD COLUMN` is not one of them: SQLite has no
 * `IF NOT EXISTS` for it and errors with "duplicate column name" on the second
 * run. So the check happens here, once, deliberately.
 *
 * Adding a nullable column rewrites no rows and loses nothing. Every existing
 * row reads back with `name` NULL, which is exactly what English wants — the
 * Worker COALESCEs onto `exercise.name`. Hindi names arrive with the next seed.
 */

const COLUMN = 'name';
const TABLE = 'exercise_instruction';

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

    await client.query(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} TEXT`, []);
    console.log(`Added ${TABLE}.${COLUMN}.`);
    console.log('Run `bun run seed -- --skip-media` to populate the Hindi names.');
};

migrate().catch((error) => {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
