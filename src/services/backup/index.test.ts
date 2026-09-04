// @ts-nocheck
const mockUser = { id: 'local-1', accountId: 'account-1' };

let mockLinked: any = null;
let mockResolveCalls: any[] = [];
let mockReadBackup: () => Promise<string | null> = async () => null;
let mockRestore: () => Promise<number> = async () => 0;
let mockPushEverythingCalls: any[] = [];
let mockPushCalls = 0;
let mockInvalidations = 0;
let mockReported: string[] = [];

jest.mock('@/crud/user', () => ({
    getCurrentUser: async () => mockLinked,
    getUserByAccountId: async () => mockLinked,
    resolveLocalUserForAccount: async (identity: any, preferredId?: string) => {
        mockResolveCalls.push({ identity, preferredId });
        return { ...mockUser, id: preferredId ?? mockUser.id };
    },
}));

jest.mock('@/services/account', () => ({
    accountIdentityFromSession: (session: any) => ({ accountId: session.user.id }),
    getSession: async () => null,
}));

jest.mock('@/crud/sync', () => ({ cleanupSyncedOperations: async () => 0 }));
jest.mock('@/queries', () => ({
    queryClient: {
        invalidateQueries: async () => {
            mockInvalidations += 1;
        },
    },
}));

jest.mock('@/services/error-reporting', () => ({
    reportError: (_error: unknown, context: string) => {
        mockReported.push(context);
    },
    runInBackground: (task: any) => {
        void Promise.resolve(typeof task === 'function' ? task() : task).catch(() => undefined);
    },
}));

jest.mock('./config', () => ({
    isBackupEnabled: () => true,
    isBackupSchemaMissing: () => false,
    isMissingBackupSchema: () => false,
    noteBackupSchemaMissing: () => undefined,
}));

jest.mock('./push', () => ({
    pushBackup: async () => {
        mockPushCalls += 1;
        return true;
    },
    pushEverything: async (userId: string, accountId: string) => {
        mockPushEverythingCalls.push({ userId, accountId });
    },
}));

jest.mock('./restore', () => ({
    readBackupLocalUserId: () => mockReadBackup(),
    restoreFromBackup: () => mockRestore(),
}));

const loadModule = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('.');
};

const loadPending = () => {
    // Deliberately not mocked: the point of these is that a write announces
    // itself and the backup hears it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./pending');
};

const identity = {
    accountId: 'account-1',
    accountEmail: 'a@example.com',
    accountProvider: 'google',
};

const reset = () => {
    mockLinked = null;
    mockResolveCalls = [];
    mockReadBackup = async () => null;
    mockRestore = async () => 0;
    mockPushEverythingCalls = [];
    mockPushCalls = 0;
    mockInvalidations = 0;
    mockReported = [];
};

/**
 * Signing in has to answer one question — which local rows this account owns —
 * and how long that takes is the difference between landing on Home and sitting
 * on About You for two seconds first.
 */
describe('preparing an account', () => {
    beforeEach(reset);

    test('a device that already knows the account does not wait on the network', async () => {
        const { syncAccountBackup } = loadModule();

        mockLinked = mockUser;
        // Never settles: if the sign-in path awaited this, the test would time out.
        mockRestore = () => new Promise<number>(() => {});

        await expect(syncAccountBackup(identity)).resolves.toMatchObject({ id: 'local-1' });
    });

    test('the background settle pushes and then tells the app to re-read', async () => {
        const { syncAccountBackup } = loadModule();

        mockLinked = mockUser;

        await syncAccountBackup(identity);

        // The settle is detached, so it lands a few microtasks later. That is the
        // point: the restored workout appears without a second sign-in.
        for (let tick = 0; tick < 8; tick += 1) await Promise.resolve();

        expect(mockPushCalls).toBe(1);
        expect(mockInvalidations).toBe(1);
    });

    test('a device that does not know the account waits for the backup first', async () => {
        const { syncAccountBackup } = loadModule();

        let restored = false;
        mockReadBackup = async () => 'OuhXmyJanSkzowMH14u7J';
        mockRestore = async () => {
            restored = true;
            return 12;
        };

        const user = await syncAccountBackup(identity);

        // The restore has to have happened before the row is resolved, or the
        // rebuilt user would take a fresh id and orphan every restored workout.
        expect(restored).toBe(true);
        expect(user.id).toBe('OuhXmyJanSkzowMH14u7J');
        expect(mockResolveCalls[0].preferredId).toBe('OuhXmyJanSkzowMH14u7J');
    });

    test('an account with no backup yet gets everything uploaded', async () => {
        const { syncAccountBackup } = loadModule();

        mockReadBackup = async () => null;

        await syncAccountBackup(identity);
        await Promise.resolve();
        await Promise.resolve();

        expect(mockPushEverythingCalls).toEqual([{ userId: 'local-1', accountId: 'account-1' }]);
    });

    test('a read that never answers is given up on rather than waited out', async () => {
        jest.useFakeTimers();

        try {
            const { syncAccountBackup } = loadModule();

            mockReadBackup = () => new Promise<string | null>(() => {});

            const pending = syncAccountBackup(identity);

            // Async form: the timer is only created once the awaits ahead of it
            // have settled, so the microtask queue has to drain first.
            await jest.advanceTimersByTimeAsync(10_000);

            const user = await pending;

            expect(user.id).toBe('local-1');
            // Nothing is assumed about the backup, so no id is forced on the row.
            expect(mockResolveCalls[0].preferredId).toBeUndefined();
            expect(mockReported).toContain('Failed to read the account backup:');
        } finally {
            jest.useRealTimers();
        }
    });

    test('nothing is uploaded when the backup could not be read', async () => {
        jest.useFakeTimers();

        try {
            const { syncAccountBackup } = loadModule();

            mockReadBackup = () => new Promise<string | null>(() => {});

            const pending = syncAccountBackup(identity);
            await jest.advanceTimersByTimeAsync(10_000);
            await pending;

            expect(mockPushEverythingCalls).toEqual([]);
        } finally {
            jest.useRealTimers();
        }
    });
});

/**
 * A workout is not one write. The row, its groups, its exercises and every set
 * are queued in turn, so reacting to each one would send a workout with no sets
 * and then push again for every set that followed.
 */
describe('pushing when a write lands', () => {
    beforeEach(reset);

    test('a burst of changes is one push, not one each', async () => {
        jest.useFakeTimers();

        try {
            const { startBackupPushes } = loadModule();
            const { notifyPendingChange } = loadPending();

            const stop = startBackupPushes();

            // `startBackupPushes` pushes once on its own, to catch up on
            // anything left over from a previous run.
            await jest.advanceTimersByTimeAsync(0);
            mockPushCalls = 0;

            notifyPendingChange();
            notifyPendingChange();
            notifyPendingChange();

            expect(mockPushCalls).toBe(0);

            await jest.advanceTimersByTimeAsync(3_000);

            expect(mockPushCalls).toBe(1);

            stop();
        } finally {
            jest.useRealTimers();
        }
    });

    test('a change after the debounce has fired starts a new one', async () => {
        jest.useFakeTimers();

        try {
            const { startBackupPushes } = loadModule();
            const { notifyPendingChange } = loadPending();

            const stop = startBackupPushes();
            await jest.advanceTimersByTimeAsync(0);
            mockPushCalls = 0;

            notifyPendingChange();
            await jest.advanceTimersByTimeAsync(3_000);

            notifyPendingChange();
            await jest.advanceTimersByTimeAsync(3_000);

            expect(mockPushCalls).toBe(2);

            stop();
        } finally {
            jest.useRealTimers();
        }
    });

    test('stopping unsubscribes, so a later write pushes nothing', async () => {
        jest.useFakeTimers();

        try {
            const { startBackupPushes } = loadModule();
            const { notifyPendingChange } = loadPending();

            const stop = startBackupPushes();
            await jest.advanceTimersByTimeAsync(0);
            stop();
            mockPushCalls = 0;

            notifyPendingChange();
            await jest.advanceTimersByTimeAsync(3_000);

            expect(mockPushCalls).toBe(0);

            stop();
        } finally {
            jest.useRealTimers();
        }
    });
});
