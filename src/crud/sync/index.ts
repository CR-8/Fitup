import { eq, count, asc, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
    fitupSyncMetadata,
    syncMetadata,
    syncQueue,
    SyncQueueInsert,
    SyncQueueSelect,
} from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { isSyncEnabled } from '@/sync/config';
import { isBackupEnabled } from '@/services/backup/config';
import { notifyPendingChange } from '@/services/backup/pending';

const SYNC_QUEUE_CLEANUP_BATCH_SIZE = 1000;
const SYNC_QUEUE_INSERT_BATCH_SIZE = 250;

/**
 * The change log every write in the app appends to.
 *
 * Two independent consumers drain it: the older device-to-server sync in
 * `src/sync`, which needs a REST host, and the account backup in
 * `src/services/backup`, which needs only an account. Either one being on is
 * reason enough to record the change; neither being on means nobody would ever
 * read the row, so it is not written.
 */
export const queueSyncOperation = async (operation: Omit<SyncQueueInsert, 'id' | 'synced'>) => {
    if (!isSyncEnabled() && !isBackupEnabled()) return;

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
    if (!isSyncEnabled() && !isBackupEnabled()) return;
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

export const markSyncOperationAsDone = async (operationId: string) => {
    await db.update(syncQueue).set({ synced: 1 }).where(eq(syncQueue.id, operationId));
};

/** Batched form, for a consumer that settles a whole table at a time. */
export const markSyncOperationsAsDone = async (operationIds: string[]): Promise<void> => {
    for (let offset = 0; offset < operationIds.length; offset += SYNC_QUEUE_INSERT_BATCH_SIZE) {
        const chunk = operationIds.slice(offset, offset + SYNC_QUEUE_INSERT_BATCH_SIZE);
        await db.update(syncQueue).set({ synced: 1 }).where(inArray(syncQueue.id, chunk));
    }
};

export const getLastSyncTimestamp = async (): Promise<Date> => {
    const metadata = await db.select().from(syncMetadata).limit(1);
    return metadata[0]?.lastSyncTimestamp || new Date(0);
};

export const updateLastSyncTimestamp = async (timestamp: Date) => {
    await db
        .insert(syncMetadata)
        .values({ id: 'default', lastSyncTimestamp: timestamp })
        .onConflictDoUpdate({
            target: syncMetadata.id,
            set: { lastSyncTimestamp: timestamp },
        });
};

export const getFitupLastSyncTimestamp = async (locale: string): Promise<Date> => {
    const normalizedLocale = locale.trim().toLowerCase();
    if (!normalizedLocale) {
        return new Date(0);
    }

    const metadata = await db
        .select()
        .from(fitupSyncMetadata)
        .where(eq(fitupSyncMetadata.locale, normalizedLocale))
        .limit(1);

    return metadata[0]?.lastSyncTimestamp || new Date(0);
};

export const updateFitupLastSyncTimestamp = async (locale: string, timestamp: Date) => {
    const normalizedLocale = locale.trim().toLowerCase();
    if (!normalizedLocale) {
        return;
    }

    await db
        .insert(fitupSyncMetadata)
        .values({ locale: normalizedLocale, lastSyncTimestamp: timestamp })
        .onConflictDoUpdate({
            target: fitupSyncMetadata.locale,
            set: { lastSyncTimestamp: timestamp },
        });
};

export const getQueueStats = async () => {
    const pending = await db
        .select({ count: count() })
        .from(syncQueue)
        .where(eq(syncQueue.synced, 0));

    const completed = await db
        .select({ count: count() })
        .from(syncQueue)
        .where(eq(syncQueue.synced, 1));

    return {
        pending: pending[0].count,
        completed: completed[0].count,
    };
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
