import { eq, getTableColumns, inArray } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { db } from '@/db';
import type { SyncQueueSelect } from '@/db/schema';
import { getPendingSyncOperations, markSyncOperationsAsDone } from '@/crud/sync';
import { getCurrentUser } from '@/crud/user';
import { isSyncEnabled } from '@/sync/config';
import { supabase } from '@/services/supabase';
import { reportError } from '@/services/error-reporting';

import {
    isBackupEnabled,
    isBackupSchemaMissing,
    isMissingBackupSchema,
    noteBackupSchemaMissing,
} from './config';
import { BACKUP_TABLES, isBackedUpTable, toRemoteRow, type BackupTableSpec } from './tables';

/**
 * Mirrors what the device has written up to the account.
 *
 * It reads the change queue every CRUD write already appends to, so no call
 * site in `src/crud` knows this exists. But it deliberately uses the queue only
 * as a list of *which* rows changed, then re-reads those rows from SQLite: the
 * queue stores its payload as JSON, which turns every `Date` into a string and
 * every superseded edit into a row of its own. Re-reading gives the current
 * truth, correctly typed, and collapses ten edits to one upsert for free.
 */

type ColumnMap = Record<string, SQLiteColumn>;

interface TableWork {
    spec: BackupTableSpec;
    /**
     * Queue rows per record, rather than one list for the whole table.
     *
     * A table's rows are not all uploaded: any belonging to a different local
     * user are filtered out, because writing them would stamp one account's
     * data into another's. Settling the whole table regardless marked those
     * writes as done without ever sending them, and the queue is the only
     * memory of what still needs uploading — so they were never backed up
     * again. Only records that were actually handled get settled now.
     */
    operationsByRecord: Map<string, string[]>;
    upsertIds: Set<string>;
    deleteIds: Set<string>;
}

const planWork = (operations: SyncQueueSelect[]) => {
    const work = new Map<string, TableWork>();
    /** Nothing will ever read these, so they are settled without being sent. */
    const ignored: string[] = [];

    for (const operation of operations) {
        if (!isBackedUpTable(operation.tableName)) {
            ignored.push(operation.id);
            continue;
        }

        let entry = work.get(operation.tableName);

        if (!entry) {
            const spec = BACKUP_TABLES.find((item) => item.local === operation.tableName)!;
            entry = {
                spec,
                operationsByRecord: new Map(),
                upsertIds: new Set(),
                deleteIds: new Set(),
            };
            work.set(operation.tableName, entry);
        }

        const forRecord = entry.operationsByRecord.get(operation.recordId) ?? [];
        forRecord.push(operation.id);
        entry.operationsByRecord.set(operation.recordId, forRecord);

        // Operations arrive oldest first, so the last word on a record wins —
        // a row created and then deleted is a delete, not both.
        if (operation.operation === 'delete') {
            entry.upsertIds.delete(operation.recordId);
            entry.deleteIds.add(operation.recordId);
        } else {
            entry.deleteIds.delete(operation.recordId);
            entry.upsertIds.add(operation.recordId);
        }
    }

    return { work, ignored };
};

/** Rows per request. Large enough to be one round trip for most histories. */
const UPSERT_CHUNK = 500;

/** Bound parameters per statement, kept well under SQLite's 999. */
const LOOKUP_CHUNK = 200;

const upsertRows = async (
    spec: BackupTableSpec,
    rows: Record<string, unknown>[],
    accountId: string,
): Promise<void> => {
    const client = supabase!;
    const payload = rows
        .filter((row) => !spec.include || spec.include(row))
        .map((row) => toRemoteRow(spec, row, accountId));

    for (let offset = 0; offset < payload.length; offset += UPSERT_CHUNK) {
        const { error } = await client
            .from(spec.remote)
            .upsert(payload.slice(offset, offset + UPSERT_CHUNK), {
                onConflict: spec.conflictTarget,
            });

        if (error) throw error;
    }
};

/** Returns the records it finished with, whether by sending them or by design. */
const pushTable = async (
    entry: TableWork,
    accountId: string,
    ownerId: string,
): Promise<Set<string>> => {
    const client = supabase!;
    const { spec } = entry;
    const columns = getTableColumns(spec.table) as ColumnMap;
    const idColumn = columns[spec.idColumn];

    // Chunked because a long offline stretch can queue more ids than SQLite
    // will accept bound parameters for in one statement.
    const ids = [...entry.upsertIds];
    const rows: Record<string, unknown>[] = [];

    for (let offset = 0; offset < ids.length; offset += LOOKUP_CHUNK) {
        const found = (await db
            .select()
            .from(spec.table)
            .where(inArray(idColumn, ids.slice(offset, offset + LOOKUP_CHUNK)))) as Record<
            string,
            unknown
        >[];

        rows.push(...found);
    }

    const present = new Set(rows.map((row) => String(row[spec.idColumn])));

    /**
     * Rows that belong to somebody else on this device.
     *
     * `useUser` writes device details to whatever row is current, and before a
     * session resolves that is the unlinked one — so a queued `user` update can
     * name a different local user than the account's. Upserting it would rewrite
     * this account's `local_user_id` and orphan every workout keyed to the real
     * one. Rows below a workout carry no owner of their own, but nothing writes
     * them for anyone but the active user either.
     */
    const { scope } = spec;
    const owned =
        scope.kind === 'user' ? rows.filter((row) => row[scope.column] === ownerId) : rows;

    // Queued as a write but gone by the time we looked: the delete is still
    // pending behind it, or the row was removed by a cascade that never
    // queued. Either way the account should not keep it.
    const deleteIds = [...entry.deleteIds];
    for (const id of entry.upsertIds) {
        if (!present.has(id)) deleteIds.push(id);
    }

    await upsertRows(spec, owned, accountId);

    // The two per-account singletons have no delete path — the local user row
    // and its training profile are updated for the life of the account.
    if (spec.conflictTarget === 'id') {
        for (let offset = 0; offset < deleteIds.length; offset += LOOKUP_CHUNK) {
            const { error } = await client
                .from(spec.remote)
                .delete()
                .in('id', deleteIds.slice(offset, offset + LOOKUP_CHUNK));

            if (error) throw error;
        }
    }

    /**
     * Everything this table is done with.
     *
     * `owned` counts even where `spec.include` dropped the row — a catalogue
     * exercise is excluded by design and will never become eligible, so leaving
     * its operation pending would grow the queue forever. What is deliberately
     * absent is any row belonging to another local user: those stay pending and
     * go up when that user is the active one.
     */
    const handled = new Set(owned.map((row) => String(row[spec.idColumn])));

    for (const id of deleteIds) handled.add(id);

    return handled;
};

/**
 * Returns true when the queue was fully drained.
 *
 * A table that fails leaves its own queue rows pending and does not stop the
 * others: a network blip mid-push must not cost the sets of a workout whose
 * parent row went up a moment earlier.
 */
export const pushBackup = async (): Promise<boolean> => {
    // The older sync owns the queue wherever it is configured. Two consumers
    // settling the same rows would race, and a host that syncs everything makes
    // this path redundant anyway.
    if (!isBackupEnabled() || isSyncEnabled() || isBackupSchemaMissing()) return false;

    const client = supabase;
    if (!client) return false;

    const { data } = await client.auth.getSession();
    const accountId = data.session?.user.id;
    if (!accountId) return false;

    const owner = await getCurrentUser();
    if (!owner) return false;

    const operations = await getPendingSyncOperations();
    if (operations.length === 0) return true;

    const { work, ignored } = planWork(operations);
    const settled = [...ignored];

    // In declaration order, so a workout reaches the account before the sets
    // that reference it.
    for (const spec of BACKUP_TABLES) {
        const entry = work.get(spec.local);
        if (!entry) continue;

        try {
            const handled = await pushTable(entry, accountId, owner.id);

            for (const recordId of handled) {
                settled.push(...(entry.operationsByRecord.get(recordId) ?? []));
            }
        } catch (error) {
            // Every remaining table would fail the same way, and so would every
            // push after this one.
            if (isMissingBackupSchema(error)) {
                noteBackupSchemaMissing();
                break;
            }

            reportError(error, `Failed to back up ${spec.local}:`, {
                tags: { scope: 'backup' },
            });
        }
    }

    if (settled.length > 0) {
        await markSyncOperationsAsDone(settled);
    }

    // Anything left pending is a record this push could not finish with — a
    // table that failed, or a row owned by a user who is not the active one.
    return settled.length === operations.length;
};

/**
 * The first upload for an account.
 *
 * The incremental push reads the change queue, and the queue only started being
 * written when this feature shipped — so everything trained before that has no
 * entry in it and would never be sent. This walks the tables directly instead.
 *
 * It runs when the account has no backup at all, which is true exactly once per
 * account: on the first sign-in from a device that has been in use.
 */
export const pushEverything = async (userId: string, accountId: string): Promise<void> => {
    const idsByTable = new Map<string, string[]>();

    for (const spec of BACKUP_TABLES) {
        const columns = getTableColumns(spec.table) as ColumnMap;
        let rows: Record<string, unknown>[] = [];

        if (spec.scope.kind === 'user') {
            rows = (await db
                .select()
                .from(spec.table)
                .where(eq(columns[spec.scope.column], userId))) as Record<string, unknown>[];
        } else {
            const parentIds = idsByTable.get(spec.scope.parent) ?? [];

            for (let offset = 0; offset < parentIds.length; offset += LOOKUP_CHUNK) {
                const chunk = parentIds.slice(offset, offset + LOOKUP_CHUNK);
                const found = (await db
                    .select()
                    .from(spec.table)
                    .where(inArray(columns[spec.scope.column!], chunk))) as Record<
                    string,
                    unknown
                >[];

                rows.push(...found);
            }
        }

        idsByTable.set(
            spec.local,
            rows.map((row) => String(row[spec.idColumn])),
        );

        await upsertRows(spec, rows, accountId);
    }
};
