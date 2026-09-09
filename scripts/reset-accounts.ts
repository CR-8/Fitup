import { mkdir, writeFile } from 'node:fs/promises';

import { loadEnvFiles } from './lib/env';
import { connectSupabase, type SupabaseClient } from './lib/supabase';

/**
 * Empties the project of accounts and everything they own, and keeps the rest.
 *
 *   bun run reset:accounts              dump and report; deletes nothing
 *   bun run reset:accounts -- --confirm dump, then actually wipe
 *
 * The flag is inverted relative to `migrate:catalogue`, which acts by default
 * and takes `--dry-run`. That one could be run again; this one cannot. Supabase
 * has no undelete for `auth.users`, so the safe direction is that doing nothing
 * is what happens when someone runs it to see what it does.
 *
 * Deleting the users is only half of it. `account_id` on every table below is a
 * plain `uuid not null default auth.uid()` with no foreign key to `auth.users`
 * — see `supabase/migrations/0001_account_backup.sql` — so nothing cascades.
 * The project already carries proof: `profiles` held eight rows against seven
 * users, the extra one belonging to an account deleted at some point with its
 * training data left behind, unreachable through RLS and invisible to everyone.
 * Removing the accounts alone would have made 886 more rows exactly like it.
 */

/* -------------------------------------------------------------------------- */
/* What is user data, and what is not                                          */
/* -------------------------------------------------------------------------- */

/**
 * Children first. Only `meal_items` -> `meals` is a real dependency
 * (`0002_diet_plans.sql:51`, on delete cascade); the rest are flat and the
 * order is for whoever reads the output.
 */
const USER_TABLES = [
    'meal_items',
    'meals',
    'exercise_sets',
    'workout_exercises',
    'workout_groups',
    'workouts',
    'custom_exercises',
    'measurements',
    'training_profiles',
    'profiles',
] as const;

/**
 * Shared reference data, and the reason this script names its tables instead of
 * enumerating the schema: the catalogue lives in the same `public` schema as
 * everything above, and emptying it would leave the app's exercise library
 * blank until `bun run seed` ran again.
 */
const KEEP_TABLES = ['catalogue_exercises', 'catalogue_instructions'] as const;

/**
 * True for every row, on a column declared `not null` in all ten tables.
 * PostgREST rejects a delete with no predicate, and this is the honest way to
 * write "all of them" — an id list would miss the orphan that prompted this.
 */
const ALL_ROWS = 'account_id=not.is.null';

/** Under `.cache/`, which is gitignored and already holds the migration dumps. */
const DUMP_ROOT = '.cache/reset';

interface AuthUser {
    id: string;
    email?: string;
    created_at?: string;
}

/* -------------------------------------------------------------------------- */
/* The auth admin API                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `lib/supabase.ts` speaks PostgREST only, and accounts do not live there.
 *
 * No custom User-Agent on these calls. The auth admin API rejects the secret
 * key when the UA looks like a browser — the exact inverse of the Management
 * API, which needs one to get past Cloudflare. This script never touches the
 * Management API, so the default is right and setting one would break it.
 */
const authAdmin = () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL!.trim().replace(/\/+$/, '');
    const key = (
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    )?.trim() as string;

    const headers = { apikey: key, authorization: `Bearer ${key}` };

    return {
        list: async (): Promise<AuthUser[]> => {
            const response = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });

            if (!response.ok) {
                throw new Error(
                    `Listing users failed: ${response.status} ${(await response.text()).slice(0, 300)}`,
                );
            }

            const body = (await response.json()) as { users?: AuthUser[] };

            return body.users ?? [];
        },

        remove: async (id: string): Promise<void> => {
            const response = await fetch(`${url}/auth/v1/admin/users/${id}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                throw new Error(
                    `Deleting ${id} failed: ${response.status} ${(await response.text()).slice(0, 300)}`,
                );
            }
        },
    };
};

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

/** Masks the local part. The dump on disk keeps the real address. */
const mask = (email: string | undefined): string => {
    if (!email?.includes('@')) return email || '(no email)';

    const [local, domain] = email.split('@');

    return `${local.slice(0, 3)}***@${domain}`;
};

const survey = async (client: SupabaseClient) => {
    const counts: Record<string, number> = {};

    for (const table of [...USER_TABLES, ...KEEP_TABLES]) {
        counts[table] = await client.count(table);
    }

    return counts;
};

/**
 * Written before a single row is deleted, on every run including the dry one.
 *
 * Once these are gone this directory is the only rollback there is, and the
 * whole of it is under a megabyte.
 */
const dump = async (client: SupabaseClient, users: AuthUser[]): Promise<string> => {
    const dir = `${DUMP_ROOT}/${new Date().toISOString().replace(/[:.]/g, '-')}`;

    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/users.json`, JSON.stringify(users, null, 2));

    for (const table of USER_TABLES) {
        const rows = await client.select<Record<string, unknown>>(`${table}?select=*`);

        await writeFile(`${dir}/${table}.json`, JSON.stringify(rows, null, 2));
    }

    return dir;
};

const main = async () => {
    loadEnvFiles();

    const confirmed = process.argv.includes('--confirm');
    const client = connectSupabase();
    const admin = authAdmin();

    const users = await admin.list();
    const before = await survey(client);

    console.log(`\n${users.length} account${users.length === 1 ? '' : 's'}:`);
    for (const user of users) {
        console.log(
            `  ${mask(user.email).padEnd(28)} created ${(user.created_at ?? '').slice(0, 10)}`,
        );
    }

    const owned = USER_TABLES.reduce((total, table) => total + before[table], 0);

    console.log(`\n${owned} rows of account data:`);
    for (const table of USER_TABLES) {
        console.log(`  ${table.padEnd(20)} ${before[table]}`);
    }

    console.log('\nkept:');
    for (const table of KEEP_TABLES) {
        console.log(`  ${table.padEnd(20)} ${before[table]}`);
    }

    const dir = await dump(client, users);
    console.log(`\ndumped to ${dir}`);

    if (!confirmed) {
        console.log('\nNothing was deleted. Re-run with --confirm to wipe.');
        return;
    }

    console.log('\ndeleting account data...');
    for (const table of USER_TABLES) {
        const removed = await client.deleteAll(table, ALL_ROWS);
        console.log(`  ${table.padEnd(20)} -${removed}`);
    }

    console.log('\ndeleting accounts...');
    for (const user of users) {
        await admin.remove(user.id);
        console.log(`  ${mask(user.email)}`);
    }

    /* ---------------------------------------------------------------------- */
    /* Verify, and fail loudly on a partial wipe                               */
    /* ---------------------------------------------------------------------- */

    const after = await survey(client);
    const remaining = await admin.list();
    const problems: string[] = [];

    for (const table of USER_TABLES) {
        if (after[table] !== 0) problems.push(`${table} still holds ${after[table]} rows`);
    }

    // The catalogue is the thing this script must not have touched, so it is
    // checked as carefully as the things it must have.
    for (const table of KEEP_TABLES) {
        if (after[table] !== before[table]) {
            problems.push(
                `${table} went from ${before[table]} to ${after[table]} — it should not have changed`,
            );
        }
    }

    if (remaining.length > 0) problems.push(`${remaining.length} accounts survived`);

    if (problems.length > 0) {
        console.error('\nIncomplete:');
        for (const problem of problems) console.error(`  ${problem}`);
        console.error(`\nThe dump at ${dir} is intact.`);
        process.exitCode = 1;
        return;
    }

    console.log(
        `\nDone. 0 accounts, 0 rows of account data, ` +
            `${KEEP_TABLES.map((t) => `${t} ${after[t]}`).join(', ')} untouched.`,
    );
    console.log(`Rollback, if it is ever needed, is ${dir}.`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
