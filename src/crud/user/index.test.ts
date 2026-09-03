// @ts-nocheck
const mockUserTable = { __name: 'user', id: 'user.id', accountId: 'user.accountId' };
const mockWorkoutTable = { __name: 'workout', id: 'workout.id', userId: 'workout.userId' };
const mockMeasurementTable = {
    __name: 'measurement',
    id: 'measurement.id',
    userId: 'measurement.userId',
};
const mockAiProfileTable = { __name: 'ai_profile', userId: 'ai_profile.userId' };

let mockRows: Record<string, any[]> = {};
let mockActiveId: string | null = null;
let mockNextId = 1;
let mockReported: string[] = [];

const mockField = (column: unknown): string => String(column).split('.')[1];

const mockMatches = (row: any, condition: any): boolean => {
    if (!condition) return true;

    switch (condition.op) {
        case 'eq':
            return row[mockField(condition.column)] === condition.value;
        case 'ne':
            return row[mockField(condition.column)] !== condition.value;
        case 'isNull': {
            const value = row[mockField(condition.column)];
            return value === null || value === undefined;
        }
        case 'and':
            return condition.conditions.every((nested: any) => mockMatches(row, nested));
        default:
            return false;
    }
};

/** `await …where(c)` and `await …where(c).limit(n)` are both used. */
const mockResult = (rows: any[]) => {
    const result: any = Promise.resolve(rows);
    result.limit = async (count: number) => rows.slice(0, count);
    return result;
};

const mockDb = {
    select: () => ({
        from: (table: { __name: string }) => ({
            where: (condition: any) =>
                mockResult(
                    (mockRows[table.__name] ?? []).filter((row) => mockMatches(row, condition)),
                ),
            limit: async (count: number) => (mockRows[table.__name] ?? []).slice(0, count),
        }),
    }),
    insert: (table: { __name: string }) => ({
        values: async (values: any) => {
            mockRows[table.__name] = [...(mockRows[table.__name] ?? []), { ...values }];
        },
    }),
    update: (table: { __name: string }) => ({
        set: (updates: any) => ({
            where: async (condition: any) => {
                mockRows[table.__name] = (mockRows[table.__name] ?? []).map((row) =>
                    mockMatches(row, condition) ? { ...row, ...updates } : row,
                );
            },
        }),
    }),
    delete: (table: { __name: string }) => ({
        where: async (condition: any) => {
            mockRows[table.__name] = (mockRows[table.__name] ?? []).filter(
                (row) => !mockMatches(row, condition),
            );
        },
    }),
};

jest.mock('drizzle-orm', () => ({
    eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
    ne: (column: unknown, value: unknown) => ({ op: 'ne', column, value }),
    isNull: (column: unknown) => ({ op: 'isNull', column }),
    and: (...conditions: unknown[]) => ({ op: 'and', conditions }),
}));

jest.mock('@/db', () => ({ db: mockDb }));
jest.mock('@/db/schema', () => ({
    user: mockUserTable,
    workout: mockWorkoutTable,
    measurement: mockMeasurementTable,
    aiProfile: mockAiProfileTable,
}));
jest.mock('@/helpers/nanoid', () => ({ nanoid: () => `local_${mockNextId++}` }));
jest.mock('@/crud/sync', () => ({ queueSyncOperation: async () => undefined }));
jest.mock('@/services/error-reporting', () => ({
    reportError: (_error: unknown, context: string) => {
        mockReported.push(context);
    },
}));
jest.mock('@/services/active-user', () => ({
    getActiveUserId: () => mockActiveId,
    setActiveUserId: (id: string) => {
        mockActiveId = id;
    },
}));

const loadModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('.');
};

const google = (accountId: string, email: string) => ({
    accountId,
    accountEmail: email,
    accountProvider: 'google' as const,
});

const reset = () => {
    mockRows = { user: [], workout: [], measurement: [], ai_profile: [] };
    mockActiveId = null;
    mockNextId = 1;
    mockReported = [];
};

/**
 * The behaviour these cover is the reason the local user row stopped being
 * "whichever row is first". One phone, two accounts, used to mean one profile.
 */
describe('the active local user', () => {
    beforeEach(reset);

    test('is the active row, not the first one in the table', async () => {
        const { getCurrentUser } = loadModule();

        mockRows.user = [
            { id: 'first', accountId: 'account-a' },
            { id: 'second', accountId: 'account-b' },
        ];
        mockActiveId = 'second';

        expect((await getCurrentUser())?.id).toBe('second');
    });

    test('falls back to the row that belongs to no account', async () => {
        const { getCurrentUser } = loadModule();

        mockRows.user = [
            { id: 'linked', accountId: 'account-a' },
            { id: 'anonymous', accountId: null },
        ];

        expect((await getCurrentUser())?.id).toBe('anonymous');
    });

    // The upgrade case: this install signed in before the pointer existed, so
    // its only row is linked and nothing points at it. Returning null here is
    // what made the app create a second, unlinked user on first launch.
    test('adopts the only row when it is linked and nothing points at it', async () => {
        const { getCurrentUser } = loadModule();

        mockRows.user = [{ id: 'upgraded', accountId: 'account-a' }];

        expect((await getCurrentUser())?.id).toBe('upgraded');
        expect(mockActiveId).toBe('upgraded');
    });

    test('is null on a device that has never created one', async () => {
        const { getCurrentUser } = loadModule();

        expect(await getCurrentUser()).toBeNull();
    });
});

describe('resolving the row for an account', () => {
    beforeEach(reset);

    test('adopts the unlinked row, so a first sign-in keeps existing training', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [{ id: 'anonymous', accountId: null }];

        const resolved = await resolveLocalUserForAccount(google('account-a', 'a@example.com'));

        expect(resolved.id).toBe('anonymous');
        expect(resolved.accountId).toBe('account-a');
        expect(mockActiveId).toBe('anonymous');
        expect(mockRows.user).toHaveLength(1);
    });

    test('gives a second account its own row and leaves the first alone', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [{ id: 'anonymous', accountId: null }];

        const first = await resolveLocalUserForAccount(google('account-a', 'a@example.com'));
        const second = await resolveLocalUserForAccount(google('account-b', 'b@example.com'));

        expect(second.id).not.toBe(first.id);
        expect(mockActiveId).toBe(second.id);
        expect(mockRows.user.find((row) => row.id === first.id).accountId).toBe('account-a');
    });

    test('returns the same row when the first account signs back in', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [{ id: 'anonymous', accountId: null }];

        const first = await resolveLocalUserForAccount(google('account-a', 'a@example.com'));
        await resolveLocalUserForAccount(google('account-b', 'b@example.com'));
        const back = await resolveLocalUserForAccount(google('account-a', 'a@example.com'));

        expect(back.id).toBe(first.id);
        expect(mockActiveId).toBe(first.id);
    });

    test('refreshes an address that changed on the account side', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [{ id: 'linked', accountId: 'account-a', accountEmail: 'old@example.com' }];

        const resolved = await resolveLocalUserForAccount(google('account-a', 'new@example.com'));

        expect(resolved.accountEmail).toBe('new@example.com');
    });

    test('rebuilds the row under the id the backup says it had', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        // What a reinstall looks like: nothing local, and a backup whose
        // workouts all carry `user_id = OuhXmyJanSkzowMH14u7J`.
        const resolved = await resolveLocalUserForAccount(
            google('account-a', 'a@example.com'),
            'OuhXmyJanSkzowMH14u7J',
        );

        expect(resolved.id).toBe('OuhXmyJanSkzowMH14u7J');
        expect(mockActiveId).toBe('OuhXmyJanSkzowMH14u7J');
    });
});

describe('clearing up unlinked leftovers', () => {
    beforeEach(reset);

    test('deletes an unlinked row that holds nothing', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [
            { id: 'linked', accountId: 'account-a' },
            { id: 'orphan', accountId: null },
        ];

        await resolveLocalUserForAccount(google('account-a', 'a@example.com'));

        expect(mockRows.user.map((row) => row.id)).toEqual(['linked']);
    });

    test.each([
        ['a workout', 'workout'],
        ['a measurement', 'measurement'],
        ['a training profile', 'ai_profile'],
    ])('keeps an unlinked row that holds %s, and says so', async (_label, table) => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [
            { id: 'linked', accountId: 'account-a' },
            { id: 'orphan', accountId: null },
        ];
        mockRows[table] = [{ id: 'row-1', userId: 'orphan' }];

        await resolveLocalUserForAccount(google('account-a', 'a@example.com'));

        expect(mockRows.user.map((row) => row.id)).toEqual(['linked', 'orphan']);
        expect(mockReported).toContain('Left an unlinked local user in place:');
    });

    test('never deletes the row it just resolved', async () => {
        const { resolveLocalUserForAccount } = loadModule();

        mockRows.user = [{ id: 'anonymous', accountId: null }];

        const resolved = await resolveLocalUserForAccount(google('account-a', 'a@example.com'));

        expect(mockRows.user.map((row) => row.id)).toEqual([resolved.id]);
    });
});
