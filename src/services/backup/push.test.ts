// @ts-nocheck
const OWNER = 'local-owner';
const STRANGER = 'local-stranger';

const mockWorkoutTable = { __name: 'workout', id: 'workout.id', userId: 'workout.userId' };

let mockWorkoutRows: any[] = [];
let mockPending: any[] = [];
let mockSettled: string[] = [];
let mockUpserted: Record<string, any[][]> = {};
let mockDeleted: string[][] = [];
let mockUpsertFails = false;
let mockOwner: any = { id: OWNER };
let mockReported: string[] = [];

const mockSpec = {
    local: 'workout',
    remote: 'workouts',
    table: mockWorkoutTable,
    idColumn: 'id',
    conflictTarget: 'id',
    scope: { kind: 'user', column: 'userId' },
    columns: { id: 'id', name: 'name', userId: 'user_id' },
    dates: [],
    deviceOnly: [],
};

jest.mock('drizzle-orm', () => ({
    eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
    inArray: (_column: unknown, values: string[]) => ({ op: 'inArray', values }),
    getTableColumns: () => ({ id: 'workout.id', userId: 'workout.userId' }),
}));

jest.mock('@/db', () => ({
    db: {
        select: () => ({
            from: () => ({
                where: async (condition: any) =>
                    mockWorkoutRows.filter((row) => condition.values.includes(row.id)),
            }),
        }),
    },
}));

jest.mock('@/db/schema', () => ({}));

jest.mock('@/crud/sync', () => ({
    getPendingSyncOperations: async () => mockPending,
    markSyncOperationsAsDone: async (ids: string[]) => {
        mockSettled.push(...ids);
    },
}));

jest.mock('@/crud/user', () => ({ getCurrentUser: async () => mockOwner }));

jest.mock('@/services/supabase', () => ({
    supabase: {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'account-1' } } } }) },
        from: (table: string) => ({
            upsert: async (rows: any[]) => {
                if (mockUpsertFails) return { error: { message: 'nope' } };
                mockUpserted[table] = [...(mockUpserted[table] ?? []), rows];
                return { error: null };
            },
            delete: () => ({
                in: async (_column: string, ids: string[]) => {
                    mockDeleted.push(ids);
                    return { error: null };
                },
            }),
        }),
    },
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (_error: unknown, context: string) => {
        mockReported.push(context);
    },
}));

jest.mock('./config', () => ({
    isBackupEnabled: () => true,
    isBackupSchemaMissing: () => false,
    isMissingBackupSchema: () => false,
    noteBackupSchemaMissing: () => undefined,
}));

jest.mock('./tables', () => ({
    BACKUP_TABLES: [mockSpec],
    isBackedUpTable: (name: string) => name === 'workout',
    toRemoteRow: (_spec: unknown, row: any) => ({ id: row.id, user_id: row.userId }),
}));

const loadModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./push');
};

const operation = (id: string, recordId: string, op = 'create') => ({
    id,
    tableName: 'workout',
    recordId,
    operation: op,
    timestamp: new Date(),
});

const reset = () => {
    mockWorkoutRows = [];
    mockPending = [];
    mockSettled = [];
    mockUpserted = {};
    mockDeleted = [];
    mockUpsertFails = false;
    mockOwner = { id: OWNER };
    mockReported = [];
};

/**
 * The change queue is the only memory of what still needs uploading. An
 * operation marked done without being sent is a write that is never backed up
 * again — so what gets settled has to be exactly what was dealt with.
 */
describe('draining the change queue', () => {
    beforeEach(reset);

    test('a row belonging to another local user stays pending', async () => {
        const { pushBackup } = loadModule();

        mockWorkoutRows = [{ id: 'w1', name: 'Planned', userId: STRANGER }];
        mockPending = [operation('op1', 'w1')];

        const complete = await pushBackup();

        expect(mockUpserted.workouts).toBeUndefined();
        // The regression: this used to be settled, and the write was lost.
        expect(mockSettled).toEqual([]);
        expect(complete).toBe(false);
    });

    test("the active user's row is uploaded and settled", async () => {
        const { pushBackup } = loadModule();

        mockWorkoutRows = [{ id: 'w1', name: 'Planned', userId: OWNER }];
        mockPending = [operation('op1', 'w1')];

        const complete = await pushBackup();

        expect(mockUpserted.workouts).toEqual([[{ id: 'w1', user_id: OWNER }]]);
        expect(mockSettled).toEqual(['op1']);
        expect(complete).toBe(true);
    });

    test('one push settles the owned row and holds the other back', async () => {
        const { pushBackup } = loadModule();

        mockWorkoutRows = [
            { id: 'mine', name: 'Mine', userId: OWNER },
            { id: 'theirs', name: 'Theirs', userId: STRANGER },
        ];
        mockPending = [operation('op-mine', 'mine'), operation('op-theirs', 'theirs')];

        await pushBackup();

        expect(mockSettled).toEqual(['op-mine']);
    });

    test('what was held back goes up once its own user is active', async () => {
        const { pushBackup } = loadModule();

        mockWorkoutRows = [{ id: 'w1', name: 'Planned', userId: STRANGER }];
        mockPending = [operation('op1', 'w1')];

        await pushBackup();
        expect(mockSettled).toEqual([]);

        mockOwner = { id: STRANGER };
        await pushBackup();

        expect(mockUpserted.workouts).toEqual([[{ id: 'w1', user_id: STRANGER }]]);
        expect(mockSettled).toEqual(['op1']);
    });

    test('a delete is sent and settled even though no row remains', async () => {
        const { pushBackup } = loadModule();

        mockPending = [operation('op1', 'w1', 'delete')];

        await pushBackup();

        expect(mockDeleted).toEqual([['w1']]);
        expect(mockSettled).toEqual(['op1']);
    });

    test('a table that fails leaves its operations pending', async () => {
        const { pushBackup } = loadModule();

        mockWorkoutRows = [{ id: 'w1', name: 'Planned', userId: OWNER }];
        mockPending = [operation('op1', 'w1')];
        mockUpsertFails = true;

        const complete = await pushBackup();

        expect(mockSettled).toEqual([]);
        expect(complete).toBe(false);
        expect(mockReported).toContain('Failed to back up workout:');
    });

    test('a queue entry for a table nothing backs up is settled, not kept forever', async () => {
        const { pushBackup } = loadModule();

        mockPending = [{ ...operation('op1', 'm1'), tableName: 'meal' }];

        await pushBackup();

        expect(mockSettled).toEqual(['op1']);
    });

    test('every edit of one record settles together', async () => {
        const { pushBackup } = loadModule();

        mockWorkoutRows = [{ id: 'w1', name: 'Renamed', userId: OWNER }];
        mockPending = [operation('op1', 'w1'), operation('op2', 'w1', 'update')];

        await pushBackup();

        // Re-read from SQLite, so two edits are one upsert.
        expect(mockUpserted.workouts).toEqual([[{ id: 'w1', user_id: OWNER }]]);
        expect(mockSettled.sort()).toEqual(['op1', 'op2']);
    });
});
