import { describe, expect, test } from '@jest/globals';
import { getTableColumns } from 'drizzle-orm';

import { BACKUP_TABLES, toLocalRow, toRemoteRow } from '@/services/backup/tables';

/**
 * Guards the seam between the device's schema and the account's.
 *
 * A column added to `src/db/schema` and forgotten here does not fail: it simply
 * never leaves the phone, and nobody finds out until a restore comes back
 * missing it. So every column of every mirrored table has to be named — either
 * as something the account carries, or explicitly as something it does not.
 */

describe('backup table map', () => {
    test.each(BACKUP_TABLES.map((spec) => [spec.local, spec] as const))(
        '%s accounts for every column',
        (_name, spec) => {
            const columns = Object.keys(getTableColumns(spec.table));
            const decided = new Set([...Object.keys(spec.columns), ...spec.deviceOnly]);

            expect(columns.filter((column) => !decided.has(column))).toEqual([]);
        },
    );

    test.each(BACKUP_TABLES.map((spec) => [spec.local, spec] as const))(
        '%s maps its primary key',
        (_name, spec) => {
            expect(spec.columns[spec.idColumn]).toBeDefined();
        },
    );

    test('remote table names are unique', () => {
        const names = BACKUP_TABLES.map((spec) => spec.remote);

        expect(new Set(names).size).toBe(names.length);
    });

    test('`order` never reaches Postgres, where it is reserved', () => {
        const offenders = BACKUP_TABLES.flatMap((spec) =>
            Object.values(spec.columns).filter((column) => column === 'order'),
        );

        expect(offenders).toEqual([]);
    });
});

describe('row conversion', () => {
    const workoutSpec = BACKUP_TABLES.find((spec) => spec.local === 'workout')!;
    const setSpec = BACKUP_TABLES.find((spec) => spec.local === 'exercise_set')!;

    test('dates become Unix milliseconds and come back as dates', () => {
        const completedAt = new Date('2026-09-03T15:55:05.062Z');

        const remote = toRemoteRow(
            workoutSpec,
            { id: 'w1', name: 'Push', status: 'completed', completedAt, userId: 'u1' },
            'account-1',
        );

        expect(remote.completed_at).toBe(completedAt.getTime());
        expect(remote.account_id).toBe('account-1');

        expect(toLocalRow(workoutSpec, remote).completedAt).toEqual(completedAt);
    });

    test('a missing value is null rather than undefined, so an upsert clears it', () => {
        const remote = toRemoteRow(workoutSpec, { id: 'w1', name: 'Push' }, 'account-1');

        expect(remote.start_at).toBeNull();
        expect(remote.duration).toBeNull();
    });

    test('the ordering column survives the rename in both directions', () => {
        const remote = toRemoteRow(setSpec, { id: 's1', order: 3, reps: 8 }, 'account-1');

        expect(remote.position).toBe(3);
        expect(remote.order).toBeUndefined();

        expect(toLocalRow(setSpec, remote).order).toBe(3);
    });

    test('the catalogue stays on the device', () => {
        const exerciseSpec = BACKUP_TABLES.find((spec) => spec.local === 'exercise')!;

        expect(exerciseSpec.include!({ userId: '__fitup__' })).toBe(false);
        expect(exerciseSpec.include!({ userId: 'OuhXmyJanSkzowMH14u7J' })).toBe(true);
    });
});
