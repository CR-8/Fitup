import { eq, count, asc, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { syncQueue, SyncQueueInsert, SyncQueueSelect } from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { isBackupEnabled } from '@/services/backup/config';
import { notifyPendingChange } from '@/services/backup/pending';

const SYNC_QUEUE_CLEANUP_BATCH_SIZE = 1000;
const SYNC_QUEUE_INSERT_BATCH_SIZE = 250;

/**
 * The change log every write in the app appends to.
 *
 * One consumer drains it: the account backup in `src/services/backup`, which
 * reads it to know which rows changed rather than diffing whole tables. There
 * were two — a device-to-server sync engine also pulled from here — and the
 * table kept its `sync_` names from that era even though only the backup is
 * left. Renaming it is a migration for no behavioural gain.
 *
 * No account means nobody would ever read the row, so it is not written.
 */
export const queueSyncOperation = async (operation: Omit<SyncQueueInsert, 'id' | 'synced'>) => {
    if (!isBackupEnabled()) return;

    const syncOperation: SyncQueueInsert = { id: nanoid(), ...operation };
    await db.insert(syncQueue).values(syncOperation).onConflictDoUpdate({
        target: syncQueue.id,
        set: syncOperation,
    });

    notifyPendingChange();
};

export const queueSyncOperations = async (
    operations: Omit<SyncQueueInsert, 'id' | 'synced'>[],
): Promise<void> => {
    if (!isBackupEnabled()) return;
    if (operations.length === 0) return;

    for (let offset = 0; offset < operations.length; offset += SYNC_QUEUE_INSERT_BATCH_SIZE) {
        const chunk = operations.slice(offset, offset + SYNC_QUEUE_INSERT_BATCH_SIZE);
        const rows = chunk.map((operation) => ({ id: nanoid(), ...operation }));
        await db.insert(syncQueue).values(rows);
    }

    notifyPendingChange();
};

export const getPendingSyncOperations = async (): Promise<SyncQueueSelect[]> => {
    return await db
        .select()
        .from(syncQueue)
        .where(eq(syncQueue.synced, 0))
        .orderBy(asc(syncQueue.timestamp));
};

export const getPendingSyncOperationsCount = async (): Promise<number> => {
    const rows = await db.select({ count: count() }).from(syncQueue).where(eq(syncQueue.synced, 0));

    return rows[0]?.count ?? 0;
};

/** Batched form, for a consumer that settles a whole table at a time. */
export const markSyncOperationsAsDone = async (operationIds: string[]): Promise<void> => {
    for (let offset = 0; offset < operationIds.length; offset += SYNC_QUEUE_INSERT_BATCH_SIZE) {
        const chunk = operationIds.slice(offset, offset + SYNC_QUEUE_INSERT_BATCH_SIZE);
        await db.update(syncQueue).set({ synced: 1 }).where(inArray(syncQueue.id, chunk));
    }
};

/**
 * Cleans up synced records from the sync queue
 * Deletes all records with synced = 1 in batches
 * @returns number of deleted records
 */
export const cleanupSyncedOperations = async (): Promise<number> => {
    try {
        let deletedCount = 0;

        while (true) {
            const batch = await db
                .select({ id: syncQueue.id })
                .from(syncQueue)
                .where(eq(syncQueue.synced, 1))
                .orderBy(asc(syncQueue.timestamp))
                .limit(SYNC_QUEUE_CLEANUP_BATCH_SIZE);

            if (batch.length === 0) {
                break;
            }

            const batchIds = batch.map((record) => record.id);

            await db.delete(syncQueue).where(inArray(syncQueue.id, batchIds));

            deletedCount += batchIds.length;

            if (batch.length < SYNC_QUEUE_CLEANUP_BATCH_SIZE) {
                break;
            }
        }

        return deletedCount;
    } catch (error) {
        reportError(error, 'Failed to clean up synced operations:');
        // Don't throw error to avoid disrupting the sync process
        return 0;
    }
};
