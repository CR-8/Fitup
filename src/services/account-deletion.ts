import * as Updates from 'expo-updates';

import { dbConnection } from '@/db';
import { queryClient } from '@/queries';
import { requireSupabase } from '@/services/supabase';
import { reportError } from '@/services/error-reporting';
import { storage } from '@/storage';

/**
 * Deleting an account, in the order that cannot strand anyone.
 *
 *   1. The server deletes the account and everything backed up (the
 *      `delete-account` function). If this fails nothing local has been touched
 *      and the person can simply try again.
 *   2. Only then is this phone wiped: every local table, and MMKV (session,
 *      settings, the Welcome flag). Wiping first would lose data for an account
 *      that still exists.
 *   3. The app reloads, so nothing from the old account survives in memory and
 *      the first-launch gate starts from Welcome.
 */

const deleteRemote = async (): Promise<void> => {
    const client = requireSupabase();
    const { data, error } = await client.functions.invoke('delete-account', { method: 'POST' });

    if (error || !(data as { deleted?: boolean } | null)?.deleted) {
        throw error ?? new Error('The server did not confirm the deletion');
    }
};

/** Every row on this device, and every stored preference. Keeps the schema, so the app can start clean. */
export const wipeLocalData = async (): Promise<void> => {
    const tables = await dbConnection.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%drizzle%'`,
    );

    await dbConnection.withTransactionAsync(async () => {
        for (const { name } of tables) {
            await dbConnection.execAsync(`DELETE FROM "${name.replace(/"/g, '""')}"`);
        }
    });

    storage.clearAll();
    queryClient.clear();
};

export const deleteAccount = async (): Promise<void> => {
    await deleteRemote();

    try {
        await wipeLocalData();
    } catch (error) {
        // The account is already gone; a failed local wipe must not read as a failed deletion.
        reportError(error, 'Failed to wipe local data after deleting the account');
    }

    try {
        await Updates.reloadAsync();
    } catch {
        // Development builds cannot reload this way; the caller navigates instead.
    }
};
