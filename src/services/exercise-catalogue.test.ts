import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

/**
 * Guards the catalogue refresh.
 *
 * The catalogue used to be a JSON file inside the app, and these tests used to
 * assert against it. It is fetched now, which moves the risk: the shape checks
 * live in the seeder, and what matters here is that a bad network does not cost
 * a user the library they already have. Every test below is some version of
 * that question.
 */

interface StoredRow {
    id: string;
    name: string;
    gifFilename: string;
}

const written: StoredRow[][] = [];
let deletedByOwner = false;

const mockDb = {
    insert: () => ({
        values: (rows: StoredRow[]) => ({
            onConflictDoUpdate: async () => {
                written.push(rows);
            },
        }),
    }),
    delete: () => ({
        where: async () => {
            deletedByOwner = true;
        },
    }),
};

jest.mock('@/db', () => ({ db: mockDb }));
jest.mock('@/db/schema', () => ({ exercise: { id: 'id', userId: 'user_id' } }));
jest.mock('@/constants/fitup', () => ({ FITUP_EXERCISES_USER_ID: '__fitup__' }));

const mockReportError = jest.fn();
jest.mock('@/services/error-reporting', () => ({ reportError: mockReportError }));

const mockStore = new Map<string, string | number>();
jest.mock('@/storage', () => ({
    storage: {
        getNumber: (key: string) => {
            const value = mockStore.get(key);
            return typeof value === 'number' ? value : undefined;
        },
        getString: (key: string) => {
            const value = mockStore.get(key);
            return typeof value === 'string' ? value : undefined;
        },
        set: (key: string, value: string | number) => mockStore.set(key, value),
        remove: (key: string) => mockStore.delete(key),
    },
}));

const SUPABASE_URL = 'https://project.supabase.test';
const SUPABASE_KEY = 'sb_publishable_test';

/**
 * The catalogue is read from the same Supabase project that holds accounts, so
 * "configured" means those two variables — there is no catalogue-specific host
 * any more. `AUTH_CONFIG` reads them at module scope, which is why every load
 * goes through `resetModules`.
 */
const loadModule = (supabaseUrl: string | undefined = SUPABASE_URL) => {
    jest.resetModules();

    if (supabaseUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;

    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_KEY;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./exercise-catalogue') as typeof import('./exercise-catalogue');
};

const entry = (id: string, name = `Exercise ${id}`, nameEn = `Exercise ${id}`) => ({
    id,
    name,
    nameEn,
    category: 'strength',
    equipment: ['barbell'],
    primaryMuscleGroups: ['pectorals'],
    secondaryMuscleGroups: [],
    gifFilename: `gif-${id}`,
    instructions: ['Step one'],
});

/** Ids are 21 characters everywhere else in the schema, so fixtures must be too. */
const id = (seed: string) => seed.padEnd(21, '0');

const page = (items: unknown[], nextCursor: string | null) => ({
    items,
    nextCursor,
    hasMore: nextCursor !== null,
});

const respondWith = (...pages: unknown[]) => {
    const fetchMock = jest.fn();

    for (const body of pages) {
        fetchMock.mockImplementationOnce(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => body,
        }));
    }

    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
};

beforeEach(() => {
    written.length = 0;
    deletedByOwner = false;
    mockStore.clear();
    mockReportError.mockClear();
});

afterEach(() => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
});

describe('configuration', () => {
    test('does nothing at all when Supabase is not configured', async () => {
        const fetchMock = respondWith(page([entry(id('a'))], null));
        const { ensureExerciseCatalogue, isExerciseApiConfigured } = loadModule('');

        expect(isExerciseApiConfigured()).toBe(false);

        await ensureExerciseCatalogue('en');

        // A build shipped without Supabase configured should not be making
        // requests to an empty host on every launch.
        expect(fetchMock).not.toHaveBeenCalled();
        expect(written).toHaveLength(0);
    });
});

describe('pagination', () => {
    test('follows the cursor to the end and writes every page', async () => {
        const fetchMock = respondWith(
            page([entry(id('a')), entry(id('b'))], id('b')),
            page([entry(id('c'))], null),
        );
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('en');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(
            new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('p_cursor'),
        ).toBeNull();
        expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('p_cursor')).toBe(
            id('b'),
        );

        // Written per page, not accumulated: an interrupted walk must leave the
        // pages it did fetch behind.
        expect(written).toHaveLength(2);
        expect(written.flat().map((row) => row.id)).toEqual([id('a'), id('b'), id('c')]);
    });

    test('keeps the pages it fetched when a later page fails', async () => {
        const fetchMock = jest.fn();
        fetchMock.mockImplementationOnce(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => page([entry(id('a'))], id('a')),
        }));
        fetchMock.mockImplementationOnce(async () => {
            throw new Error('connection reset');
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const { ensureExerciseCatalogue, isCatalogueSeeded } = loadModule();

        await ensureExerciseCatalogue('en');

        expect(written.flat().map((row) => row.id)).toEqual([id('a')]);
        expect(mockReportError).toHaveBeenCalled();
        // The walk did not complete, so nothing may claim the catalogue is current.
        expect(isCatalogueSeeded()).toBe(false);
    });

    test('stops rather than looping when the cursor does not advance', async () => {
        const stuck = page([entry(id('a'))], id('a'));
        const fetchMock = respondWith(stuck, stuck, stuck, stuck);
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('en');

        // Second request detects the repeat and aborts; without that guard this
        // would spin until the page ceiling, refetching one page 200 times.
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(mockReportError).toHaveBeenCalled();
    });
});

describe('rejecting bad data', () => {
    test('writes nothing from a page containing a malformed entry', async () => {
        respondWith(page([entry(id('a')), { id: 'too-short', name: 'Broken' }], null));
        const { ensureExerciseCatalogue, isCatalogueSeeded } = loadModule();

        await ensureExerciseCatalogue('en');

        // Partially writing a page would put a row with a 9-character id into a
        // schema where every other id is 21, and it would surface far from here.
        expect(written).toHaveLength(0);
        expect(isCatalogueSeeded()).toBe(false);
        expect(mockReportError).toHaveBeenCalled();
    });

    test('accepts a page from a project whose catalogue_page predates nameEn', async () => {
        // The app and the database migrate independently. If a missing `nameEn`
        // were fatal, an app update would refuse every page until the migration
        // had been applied — and the symptom would be a library that quietly
        // stopped updating, which is exactly what this module exists to prevent.
        const { nameEn: _dropped, ...withoutNameEn } = entry(id('a'));
        respondWith(page([withoutNameEn], null));
        const { ensureExerciseCatalogue, isCatalogueSeeded } = loadModule();

        await ensureExerciseCatalogue('en');

        expect(written.flat()).toHaveLength(1);
        expect(isCatalogueSeeded()).toBe(true);
        expect(mockReportError).not.toHaveBeenCalled();
    });

    test('rejects an unknown category rather than storing it', async () => {
        respondWith(page([{ ...entry(id('a')), category: 'interpretive-dance' }], null));
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('en');

        expect(written).toHaveLength(0);
        expect(mockReportError).toHaveBeenCalled();
    });

    test('treats a non-2xx response as a failure and keeps local data', async () => {
        global.fetch = jest.fn(async () => ({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({}),
        })) as unknown as typeof fetch;

        const { ensureExerciseCatalogue, isCatalogueSeeded } = loadModule();

        await ensureExerciseCatalogue('en');

        expect(written).toHaveLength(0);
        expect(deletedByOwner).toBe(false);
        expect(isCatalogueSeeded()).toBe(false);
        expect(mockReportError).toHaveBeenCalled();
    });
});

describe('refresh throttling', () => {
    test('does not refetch inside the five minute window', async () => {
        const fetchMock = respondWith(page([entry(id('a'))], null), page([entry(id('a'))], null));
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('en');
        await ensureExerciseCatalogue('en');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('refetches once the window has passed', async () => {
        const fetchMock = respondWith(page([entry(id('a'))], null), page([entry(id('a'))], null));
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('en');

        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);

        await ensureExerciseCatalogue('en');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        jest.restoreAllMocks();
    });

    test('refetches immediately when the language changes', async () => {
        const fetchMock = respondWith(page([entry(id('a'))], null), page([entry(id('a'))], null));
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('en');
        await ensureExerciseCatalogue('hi');

        // Instructions are per-locale, so a language switch must not be
        // suppressed by a refresh that fetched a different language.
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('p_locale')).toBe(
            'hi',
        );
    });

    test('normalises a regional tag to its base language', async () => {
        const fetchMock = respondWith(page([entry(id('a'))], null));
        const { ensureExerciseCatalogue } = loadModule();

        await ensureExerciseCatalogue('hi-IN');

        expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('p_locale')).toBe(
            'hi',
        );
    });
});

describe('resetExerciseCatalogue', () => {
    test('deletes by ownership and clears the refresh markers', async () => {
        respondWith(page([entry(id('a'))], null));
        const { ensureExerciseCatalogue, resetExerciseCatalogue, isCatalogueSeeded } = loadModule();

        await ensureExerciseCatalogue('en');
        expect(isCatalogueSeeded()).toBe(true);

        await resetExerciseCatalogue();

        // Ownership, not a list of ids read from a bundle that no longer exists.
        // This also catches rows from a catalogue version this build never saw.
        expect(deletedByOwner).toBe(true);
        expect(isCatalogueSeeded()).toBe(false);
    });
});

/**
 * A refresh walks fourteen pages against the real catalogue, which is long
 * enough for a language change to land in the middle of one. Both walks then
 * write the same rows page by page and the slower request wins each one, so the
 * library comes out part Hindi and part English — and the marker the second
 * walk stores tells `isRefreshFresh` the job is done, which makes it stick.
 */
describe('a language change during a refresh', () => {
    test('the overtaken walk stops writing and does not claim the catalogue', async () => {
        let releaseSecondPage: (() => void) | null = null;
        const secondPageReached = new Promise<void>((resolve) => {
            releaseSecondPage = resolve;
        });

        const fetchMock = jest.fn();
        // Page 1 of the English walk: more to come.
        fetchMock.mockImplementationOnce(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => page([entry(id('en1'), 'English one')], id('en1')),
        }));
        // Page 2 of the English walk, held open until Hindi has finished.
        fetchMock.mockImplementationOnce(async () => {
            await secondPageReached;

            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => page([entry(id('en2'), 'English two')], null),
            };
        });
        // The Hindi walk, one page and done.
        fetchMock.mockImplementationOnce(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => page([entry(id('en1'), 'हिन्दी एक')], null),
        }));
        global.fetch = fetchMock as unknown as typeof fetch;

        const { ensureExerciseCatalogue } = loadModule();

        const english = ensureExerciseCatalogue('en');
        // Let the English walk get as far as requesting its second page.
        await new Promise((resolve) => setImmediate(resolve));

        await ensureExerciseCatalogue('hi');

        releaseSecondPage!();
        await english;

        const names = written.flat().map((row) => row.name);

        // "English two" is the row the overtaken walk would have written on top
        // of a catalogue that is now Hindi.
        expect(names).toEqual(['English one', 'हिन्दी एक']);
        expect(mockStore.get('catalogue.locale')).toBe('hi');
    });
});
