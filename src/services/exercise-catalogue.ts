import { eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { exercise, type ExerciseInsert } from '@/db/schema';
import { FITUP_EXERCISES_USER_ID } from '@/constants/fitup';
import { storage } from '@/storage';
import { reportError } from '@/services/error-reporting';

/**
 * Fetches the exercise catalogue and keeps it in SQLite.
 *
 * The catalogue used to ship inside the app as ~4.8 MB of JSON. It now comes
 * from the exercise API, which lets it be corrected and extended without a
 * store release, and lets each exercise carry the media URL for its animation.
 *
 * What that costs, stated plainly: a fresh install that has never reached the
 * API has no exercises. Everything below exists to make sure that is the *only*
 * case where the library is empty — an install that has synced once keeps its
 * catalogue permanently, offline, and a failed refresh never removes a row.
 *
 * Rows are written as system exercises under the reserved user id, so the
 * existing ownership rules apply unchanged: they cannot be edited or deleted in
 * place, and editing one forks it into a user-owned copy.
 */

interface RemoteExercise {
    id: string;
    /** Localised where the API has a translation, English otherwise. */
    name: string;
    /**
     * Always English, whatever locale was asked for. Optional: a Worker that
     * has not been redeployed yet does not send it, and a page missing it is
     * still a perfectly usable page.
     */
    nameEn?: string;
    category: 'strength' | 'cardio' | 'flexibility' | 'yoga' | 'pilates' | 'other';
    equipment: string[];
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    gifFilename: string;
    instructions: string[];
}

interface RemotePage {
    items: RemoteExercise[];
    nextCursor: string | null;
    hasMore: boolean;
}

/**
 * Bump when the catalogue's shape or source changes. A bump makes
 * `isCatalogueSeeded()` false exactly once per install, forcing one refresh.
 *
 * 2: catalogue moved from bundled JSON to the exercise API.
 * 3: rows carry `nameEn`, and `name` became localised. Existing rows have a
 *    null `nameEn` and an English `name`, so one forced refresh is what makes
 *    Hindi names appear and keeps search working in both scripts.
 */
const CATALOGUE_VERSION = 3;

const VERSION_KEY = 'catalogue.version';
const LOCALE_KEY = 'catalogue.locale';
const FETCHED_AT_KEY = 'catalogue.fetchedAt';

/**
 * Written so a future SyncLayer deployment sees the catalogue as current and
 * does not seed the same rows a second time through `pullFitupChanges`.
 */
const SYNC_DATASET_VERSION = 1;
const syncDatasetVersionKey = (locale: string) => `fitup.dataset.exercise.version.${locale}`;

/** How long a completed refresh is trusted before another is attempted. */
const REFRESH_TTL_MS = 5 * 60 * 1000;

/** Rows requested per page. The API clamps anything above 100. */
const PAGE_SIZE = 100;

/**
 * Ceiling on pages walked in one refresh. At 100 rows a page this allows a
 * catalogue two orders of magnitude larger than today's, while guaranteeing a
 * malformed `nextCursor` cannot spin forever.
 */
const MAX_PAGES = 200;

/** SQLite caps bound parameters per statement; each row binds ~14 columns. */
const INSERT_BATCH_SIZE = 60;

const API_BASE_URL = (process.env.EXPO_PUBLIC_EXERCISE_API_URL ?? '').trim().replace(/\/+$/, '');

export const isExerciseApiConfigured = (): boolean => API_BASE_URL.length > 0;

const normalizeLocale = (locale: string): string => locale.toLowerCase().split(/[-_]/)[0];

type ExerciseTracking = NonNullable<ExerciseInsert['tracking']>;

const STRENGTH_TRACKING: ExerciseTracking = ['weight', 'reps'];
const CARDIO_TRACKING: ExerciseTracking = ['time', 'distance'];

const CATEGORIES = new Set(['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other']);

/**
 * Rejects a page rather than writing something the rest of the app cannot use.
 *
 * The catalogue is remote now, so a deploy could serve a half-migrated row. An
 * id of the wrong width or an unknown category would land in SQLite and surface
 * as a broken row on a screen far away from here.
 */
const isValidExercise = (value: unknown): value is RemoteExercise => {
    if (typeof value !== 'object' || value === null) return false;

    const candidate = value as Partial<RemoteExercise>;

    return (
        typeof candidate.id === 'string' &&
        candidate.id.length === 21 &&
        typeof candidate.name === 'string' &&
        candidate.name.trim().length > 0 &&
        // Deliberately not required. Rejecting a page for a missing `nameEn`
        // would mean an app update could only refresh its catalogue after the
        // Worker was redeployed — an ordering trap whose failure mode is a
        // library that silently stops updating.
        (candidate.nameEn === undefined || typeof candidate.nameEn === 'string') &&
        typeof candidate.category === 'string' &&
        CATEGORIES.has(candidate.category) &&
        Array.isArray(candidate.equipment) &&
        Array.isArray(candidate.primaryMuscleGroups) &&
        Array.isArray(candidate.secondaryMuscleGroups) &&
        typeof candidate.gifFilename === 'string' &&
        Array.isArray(candidate.instructions)
    );
};

const parsePage = (value: unknown): RemotePage => {
    if (typeof value !== 'object' || value === null) {
        throw new Error('Catalogue page is not an object');
    }

    const candidate = value as Partial<RemotePage>;

    if (!Array.isArray(candidate.items)) {
        throw new Error('Catalogue page has no items array');
    }

    const items = candidate.items.filter(isValidExercise);

    if (items.length !== candidate.items.length) {
        throw new Error(
            `Catalogue page contains ${candidate.items.length - items.length} malformed entries`,
        );
    }

    return {
        items,
        nextCursor: typeof candidate.nextCursor === 'string' ? candidate.nextCursor : null,
        hasMore: candidate.hasMore === true,
    };
};

const fetchPage = async (locale: string, cursor: string | null): Promise<RemotePage> => {
    const url = new URL(`${API_BASE_URL}/v1/exercises`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('locale', locale);
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(`Catalogue request failed: ${response.status} ${response.statusText}`);
    }

    return parsePage(await response.json());
};

const toRow = (item: RemoteExercise): ExerciseInsert => ({
    id: item.id,
    name: item.name,
    // Falls back to the name we did get, so search has something in the second
    // slot either way and never has to special-case a half-migrated row.
    nameEn: item.nameEn?.trim() || item.name,
    category: item.category,
    tracking: item.category === 'cardio' ? CARDIO_TRACKING : STRENGTH_TRACKING,
    source: 'system' as const,
    userId: FITUP_EXERCISES_USER_ID,
    equipment: item.equipment,
    primaryMuscleGroups: item.primaryMuscleGroups,
    secondaryMuscleGroups: item.secondaryMuscleGroups,
    instructions: item.instructions,
    gifFilename: item.gifFilename,
    confidence: 'high' as const,
});

/** In an upsert, `excluded.<column>` is the value from the row that conflicted. */
const excluded = (column: string) => sql.raw(`excluded.${column}`);

const writeRows = async (rows: ExerciseInsert[]): Promise<void> => {
    for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
        const chunk = rows.slice(offset, offset + INSERT_BATCH_SIZE);

        await db
            .insert(exercise)
            .values(chunk)
            .onConflictDoUpdate({
                target: exercise.id,
                // Only catalogue-owned columns are refreshed. A user who edited an
                // entry owns a forked row with a different id, so their work is
                // never overwritten by a re-seed.
                set: {
                    name: excluded('name'),
                    nameEn: excluded('name_en'),
                    category: excluded('category'),
                    equipment: excluded('equipment'),
                    primaryMuscleGroups: excluded('primary_muscle_groups'),
                    secondaryMuscleGroups: excluded('secondary_muscle_groups'),
                    instructions: excluded('instructions'),
                    gifFilename: excluded('gif_filename'),
                },
            });
    }
};

/**
 * Walks every page, writing each as it arrives.
 *
 * Writing per page rather than accumulating and writing once at the end is
 * deliberate: a refresh interrupted at page 7 of 14 leaves 700 usable exercises
 * behind instead of nothing.
 */
const refresh = async (locale: string): Promise<void> => {
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
        const { items, nextCursor, hasMore }: RemotePage = await fetchPage(locale, cursor);

        if (items.length > 0) await writeRows(items.map(toRow));

        if (!hasMore || !nextCursor) return;

        // A server that keeps claiming another page while handing back the same
        // cursor would otherwise loop until MAX_PAGES, refetching one page.
        if (nextCursor === cursor) {
            throw new Error('Catalogue pagination stalled: cursor did not advance');
        }

        cursor = nextCursor;
    }

    throw new Error(`Catalogue pagination exceeded ${MAX_PAGES} pages`);
};

export const isCatalogueSeeded = (): boolean =>
    storage.getNumber(VERSION_KEY) === CATALOGUE_VERSION;

const isRefreshFresh = (locale: string): boolean => {
    if (!isCatalogueSeeded()) return false;
    if (storage.getString(LOCALE_KEY) !== locale) return false;

    const fetchedAt = storage.getNumber(FETCHED_AT_KEY);
    if (fetchedAt === undefined) return false;

    return Date.now() - fetchedAt < REFRESH_TTL_MS;
};

/**
 * Ensures the catalogue is present and in the requested language.
 *
 * Safe to call on every launch: within the TTL, and in the same language, it
 * does nothing.
 *
 * Never throws, and never deletes. A device that is offline when a new
 * `CATALOGUE_VERSION` lands keeps every row it already had and simply tries
 * again next launch — which is what stops an upgrade from emptying the library
 * of an install that was working perfectly well a minute earlier.
 */
export const ensureExerciseCatalogue = async (locale: string): Promise<void> => {
    if (!isExerciseApiConfigured()) return;

    const normalized = normalizeLocale(locale);
    if (isRefreshFresh(normalized)) return;

    try {
        await refresh(normalized);

        storage.set(VERSION_KEY, CATALOGUE_VERSION);
        storage.set(LOCALE_KEY, normalized);
        storage.set(FETCHED_AT_KEY, Date.now());
        storage.set(syncDatasetVersionKey(normalized), SYNC_DATASET_VERSION);
    } catch (error) {
        // A catalogue that fails to refresh must not stop the app from opening,
        // and must not disturb what is already stored; the user can still train
        // on whatever they have and create their own exercises.
        reportError(error, 'Failed to refresh the exercise catalogue');
    }
};

/**
 * Removes every catalogue row. User-authored exercises and forks are untouched,
 * because a fork is owned by the user rather than by the reserved catalogue id.
 */
export const resetExerciseCatalogue = async (): Promise<void> => {
    // Previously this deleted by the id list read from the bundled JSON. With no
    // bundle to read, ownership is the definition of a catalogue row — which is
    // also more correct, since it catches rows from a catalogue version this
    // build no longer knows about.
    await db.delete(exercise).where(eq(exercise.userId, FITUP_EXERCISES_USER_ID));

    storage.remove(VERSION_KEY);
    storage.remove(LOCALE_KEY);
    storage.remove(FETCHED_AT_KEY);
};

/** Exported for tests and for callers that need to drop a specific set of rows. */
export const deleteCatalogueRows = async (ids: string[]): Promise<void> => {
    for (let offset = 0; offset < ids.length; offset += INSERT_BATCH_SIZE) {
        await db
            .delete(exercise)
            .where(inArray(exercise.id, ids.slice(offset, offset + INSERT_BATCH_SIZE)));
    }
};
