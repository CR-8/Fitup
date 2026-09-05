import { getTableColumns, inArray } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { db } from '@/db';
import { supabase } from '@/services/supabase';

import { BACKUP_TABLES, toLocalRow, type BackupTableSpec } from './tables';

/**
 * Rebuilds the device from the account.
 *
 * Run on sign-in. On a phone that already holds this account's data it is a
 * merge that changes nothing; on a fresh install it is the reason the workouts
 * come back.
 *
 * Newest wins, per row, on `updatedAt`. That is the honest limit of this
 * design: it restores and it merges, but two phones editing the same workout
 * while both offline will keep only one of the two edits. One account training
 * on one phone at a time is the shape being solved.
 */

type ColumnMap = Record<string, SQLiteColumn>;

/** PostgREST caps a response at 1,000 rows; a long training history exceeds it. */
const PAGE_SIZE = 1000;

/** ~20 columns a row, kept under SQLite's 999 bound parameters per statement. */
const INSERT_CHUNK = 40;

const readMillis = (value: unknown): number => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return 0;
};

const fetchAll = async (remote: string): Promise<Record<string, unknown>[]> => {
    const client = supabase!;
    const rows: Record<string, unknown>[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
            .from(remote)
            .select('*')
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        rows.push(...(data as Record<string, unknown>[]));

        if (data.length < PAGE_SIZE) break;
    }

    return rows;
};

/**
 * The local user id the account's rows are keyed by, or null when this account
 * has never backed anything up.
 */
export const readBackupLocalUserId = async (): Promise<string | null> => {
    const client = supabase;
    if (!client) return null;

    const { data, error } = await client
        .from('profiles')
        .select('local_user_id')
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    const localUserId = (data as { local_user_id?: unknown } | null)?.local_user_id;

    return typeof localUserId === 'string' && localUserId.length > 0 ? localUserId : null;
};

const restoreTable = async (spec: BackupTableSpec): Promise<number> => {
    const remoteRows = await fetchAll(spec.remote);
    if (remoteRows.length === 0) return 0;

    const columns = getTableColumns(spec.table) as ColumnMap;
    const idColumn = columns[spec.idColumn];

    const localRows = remoteRows.map((row) => toLocalRow(spec, row));
    const ids = localRows.map((row) => String(row[spec.idColumn]));

    const existing = new Map<string, number>();

    for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
        const chunk = ids.slice(offset, offset + PAGE_SIZE);
        const found = (await db
            .select()
            .from(spec.table)
            .where(inArray(idColumn, chunk))) as Record<string, unknown>[];

        for (const row of found) {
            existing.set(String(row[spec.idColumn]), readMillis(row.updatedAt));
        }
    }

    const inserts: Record<string, unknown>[] = [];
    let written = 0;

    for (const row of localRows) {
        const id = String(row[spec.idColumn]);
        const localUpdatedAt = existing.get(id);

        if (localUpdatedAt === undefined) {
            inserts.push(row);
            continue;
        }

        // Equal timestamps mean the two sides already agree — the common case
        // on every sign-in after the first, and not worth a write.
        if (readMillis(row.updatedAt) <= localUpdatedAt) continue;

        const { [spec.idColumn]: _id, ...updates } = row;
        await db
            .update(spec.table)
            .set(updates)
            .where(inArray(idColumn, [id]));
        written += 1;
    }

    for (let offset = 0; offset < inserts.length; offset += INSERT_CHUNK) {
        const chunk = inserts.slice(offset, offset + INSERT_CHUNK);
        await db.insert(spec.table).values(chunk);
        written += chunk.length;
    }

    return written;
};

/** Returns how many rows the device gained or refreshed. */
export const restoreFromBackup = async (): Promise<number> => {
    if (!supabase) return 0;

    let written = 0;

    // Declaration order is parent-first, so the user row exists before the
    // workouts that reference it and a workout before its sets. Nothing here
    // depends on that — foreign keys are off — but a partial restore that fails
    // halfway leaves something coherent rather than orphaned sets.
    for (const spec of BACKUP_TABLES) {
        written += await restoreTable(spec);
    }

    return written;
};
