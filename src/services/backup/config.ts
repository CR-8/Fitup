import { isAuthConfigured } from '@/constants/auth';

/**
 * Whether the profile and training history are backed up to the account.
 *
 * Tied to accounts rather than to its own flag: the backup is written to
 * Supabase as the signed-in user and authorized by row-level security, so a
 * build with no account backend has nowhere to put it and no identity to put it
 * under. There is nothing to configure separately.
 *
 * This is deliberately not `isSyncEnabled()`. That one gates the older
 * device-to-server sync in `src/sync`, which needs a REST host that was never
 * deployed; the two paths are independent and only share the change queue.
 */
export const isBackupEnabled = (): boolean => isAuthConfigured();

/**
 * PostgREST reports a table it cannot see as PGRST205; Postgres itself as
 * 42P01. Either means the same thing here: `supabase/migrations` has not been
 * applied to this project.
 */
export const isMissingBackupSchema = (error: unknown): boolean => {
    const code = (error as { code?: unknown } | null)?.code;

    return code === 'PGRST205' || code === '42P01';
};

/**
 * A build can be pointed at a Supabase project that has accounts but not the
 * backup tables — which is every project until the migration is run once.
 *
 * That is a setup step, not a fault, and it does not recover by being retried:
 * without this the push loop would report the same failure for every table
 * every two minutes for the life of the process. So it is said once, plainly
 * enough to act on, and the backup then stands down until the app restarts.
 */
let schemaMissing = false;

export const noteBackupSchemaMissing = (): void => {
    if (schemaMissing) return;

    schemaMissing = true;
    console.warn(
        '[backup] The account backup tables are missing. Run ' +
            'supabase/migrations/0001_account_backup.sql in the Supabase SQL editor, ' +
            'then restart the app. Training is kept on this device in the meantime.',
    );
};

export const isBackupSchemaMissing = (): boolean => schemaMissing;
