import { eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { exercise, type ExerciseInsert } from '@/db/schema';
import { FITUP_EXERCISES_USER_ID } from '@/constants/fitup';
import { storage } from '@/storage';
import { reportError } from '@/services/error-reporting';

import catalogue from '../../assets/exercises/catalogue.json';

/**
 * Seeds the bundled exercise catalogue into SQLite.
 *
 * The catalogue is shipped with the app rather than fetched, so a fresh install
 * has a usable exercise library with no account and no network — the same
 * local-first guarantee the rest of the product makes.
 *
 * Rows are written as system exercises under the reserved user id, so the
 * existing ownership rules apply unchanged: they cannot be edited or deleted in
 * place, and editing one forks it into a user-owned copy.
 */

interface CatalogueEntry {
    id: string;
    name: string;
    category: 'strength' | 'cardio' | 'flexibility' | 'yoga' | 'pilates' | 'other';
    equipment: string[];
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    gifFilename: string;
}

/** Bump when the generated catalogue changes shape or content. */
const CATALOGUE_VERSION = 1;

const VERSION_KEY = 'catalogue.version';
const LOCALE_KEY = 'catalogue.locale';

// SQLite caps bound parameters per statement; each row binds ~14 columns.
const INSERT_BATCH_SIZE = 60;

const entries = catalogue as CatalogueEntry[];

/**
 * Instruction text is split per locale so only the language in use is parsed.
 * Metro needs a static specifier for each, hence the switch rather than a
 * computed path.
 */
const loadInstructions = (locale: string): Record<string, string[]> => {
    switch (locale) {
        case 'es':
            return require('../../assets/exercises/instructions.es.json');
        case 'hi':
            return require('../../assets/exercises/instructions.hi.json');
        case 'ru':
            return require('../../assets/exercises/instructions.ru.json');
        case 'zh':
            return require('../../assets/exercises/instructions.zh.json');
        default:
            return require('../../assets/exercises/instructions.en.json');
    }
};

const normalizeLocale = (locale: string): string => locale.toLowerCase().split(/[-_]/)[0];

type ExerciseTracking = NonNullable<ExerciseInsert['tracking']>;

const STRENGTH_TRACKING: ExerciseTracking = ['weight', 'reps'];
const CARDIO_TRACKING: ExerciseTracking = ['time', 'distance'];

const buildRows = (locale: string): ExerciseInsert[] => {
    const instructions = loadInstructions(locale);

    return entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        tracking: entry.category === 'cardio' ? CARDIO_TRACKING : STRENGTH_TRACKING,
        source: 'system' as const,
        userId: FITUP_EXERCISES_USER_ID,
        equipment: entry.equipment,
        primaryMuscleGroups: entry.primaryMuscleGroups,
        secondaryMuscleGroups: entry.secondaryMuscleGroups,
        instructions: instructions[entry.id] ?? [],
        gifFilename: entry.gifFilename,
        confidence: 'high' as const,
    }));
};

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
 * Rewrites instruction text for the catalogue without touching anything else.
 * Used when the interface language changes after seeding.
 */
const updateInstructions = async (locale: string): Promise<void> => {
    const instructions = loadInstructions(locale);
    const ids = entries.map((entry) => entry.id);

    for (let offset = 0; offset < ids.length; offset += INSERT_BATCH_SIZE) {
        const chunk = ids.slice(offset, offset + INSERT_BATCH_SIZE);

        await Promise.all(
            chunk.map((id) =>
                db
                    .update(exercise)
                    .set({ instructions: instructions[id] ?? [] })
                    .where(eq(exercise.id, id)),
            ),
        );
    }
};

export const isCatalogueSeeded = (): boolean =>
    storage.getNumber(VERSION_KEY) === CATALOGUE_VERSION;

/**
 * Ensures the catalogue is present and in the requested language.
 *
 * Safe to call on every launch: it does nothing once the current version is
 * seeded and the language still matches.
 */
export const ensureExerciseCatalogue = async (locale: string): Promise<void> => {
    const normalized = normalizeLocale(locale);

    try {
        if (!isCatalogueSeeded()) {
            await writeRows(buildRows(normalized));
            storage.set(VERSION_KEY, CATALOGUE_VERSION);
            storage.set(LOCALE_KEY, normalized);
            return;
        }

        if (storage.getString(LOCALE_KEY) !== normalized) {
            await updateInstructions(normalized);
            storage.set(LOCALE_KEY, normalized);
        }
    } catch (error) {
        // A catalogue that fails to seed must not stop the app from opening; the
        // user can still create their own exercises and train.
        reportError(error, 'Failed to seed the exercise catalogue');
    }
};

/** Removes every catalogue row. User-authored exercises and forks are untouched. */
export const resetExerciseCatalogue = async (): Promise<void> => {
    const ids = entries.map((entry) => entry.id);

    for (let offset = 0; offset < ids.length; offset += INSERT_BATCH_SIZE) {
        await db
            .delete(exercise)
            .where(inArray(exercise.id, ids.slice(offset, offset + INSERT_BATCH_SIZE)));
    }

    storage.remove(VERSION_KEY);
    storage.remove(LOCALE_KEY);
};
