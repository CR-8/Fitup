import { createHash } from 'node:crypto';

/**
 * The exercises-dataset, and the derivations every consumer must agree on.
 *
 * Source: https://github.com/hasaneyldrm/exercises-dataset
 *
 * Licensing, which drives what this module does and does not do:
 *
 *   - The exercise DATA (names, body parts, equipment, muscles, and the
 *     multilingual instructions) is MIT licensed.
 *   - The exercise MEDIA (the GIFs and thumbnails) is NOT MIT. It is
 *     © Gym visual, redistributed in that repository under a written permission
 *     granted to its author, capped at 180x180, and its NOTICE states plainly
 *     that cloning the repository grants no rights to the media.
 *
 * Nothing here downloads media. `datasetGifUrl` only names where a GIF lives so
 * a caller holding its own licence can fetch it.
 *
 * `buildStableId` is the reason this file exists rather than each script
 * carrying its own copy. Ids derived here are already stored in every user's
 * SQLite; a change to the hash would orphan their catalogue instead of updating
 * it, so the two scripts must derive them identically or not at all.
 */

const DATASET_RAW_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';

/** Locales the app ships. The dataset carries ten; the rest are dead weight. */
export const LOCALES = ['en', 'es', 'hi', 'ru', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export interface DatasetRecord {
    id: string;
    name: string;
    body_part: string;
    equipment: string;
    target: string;
    muscle_group: string;
    secondary_muscles: string[];
    media_id: string;
    image: string;
    gif_url: string;
    attribution: string;
    instruction_steps: Record<string, string[]>;
}

/** Mirrors the `category` enum on the local exercise table. */
export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'yoga' | 'pilates' | 'other';

export const EXERCISE_CATEGORIES: readonly ExerciseCategory[] = [
    'strength',
    'cardio',
    'flexibility',
    'yoga',
    'pilates',
    'other',
];

export interface CatalogueEntry {
    id: string;
    name: string;
    category: ExerciseCategory;
    equipment: string[];
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    /** Media basename, without directory or extension. */
    gifFilename: string;
}

/**
 * Stable 21-character id derived from the record, matching the width of the
 * NanoIDs used everywhere else. Deterministic so re-running the import updates
 * rows in place instead of duplicating the catalogue.
 */
export const buildStableId = (record: DatasetRecord): string =>
    createHash('sha1')
        .update(`exercises-dataset:${record.id}:${record.media_id}`)
        .digest('base64url')
        .slice(0, 21);

/** The dataset's body part is anatomical; the local category is a training modality. */
const resolveCategory = (bodyPart: string): ExerciseCategory =>
    bodyPart === 'cardio' ? 'cardio' : 'strength';

/** "hip flexors" -> "hip_flexors", matching the app's muscle vocabulary. */
const normalizeMuscle = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '_');

const uniq = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

export const toCatalogueEntry = (record: DatasetRecord): CatalogueEntry => ({
    id: buildStableId(record),
    name: record.name,
    category: resolveCategory(record.body_part),
    // Kept as free-form lowercase to match the equipment strings already used by
    // user-authored exercises.
    equipment: uniq([record.equipment.trim().toLowerCase()]),
    primaryMuscleGroups: uniq([record.target, record.body_part].map(normalizeMuscle)),
    secondaryMuscleGroups: uniq(
        [record.muscle_group, ...record.secondary_muscles].map(normalizeMuscle),
    ),
    // `videos/0001-2gPfomN.gif` -> `0001-2gPfomN`
    gifFilename: record.gif_url.replace(/^.*\//, '').replace(/\.gif$/i, ''),
});

/**
 * Where a record's animation lives upstream.
 *
 * `gif_url` is repository-relative (`videos/0001-2gPfomN.gif`), so it is joined
 * to the raw host rather than used directly.
 */
export const datasetGifUrl = (record: DatasetRecord): string =>
    `${DATASET_RAW_BASE}/${record.gif_url.replace(/^\/+/, '')}`;

export const fetchDataset = async (): Promise<DatasetRecord[]> => {
    const response = await fetch(`${DATASET_RAW_BASE}/data/exercises.json`);

    if (!response.ok) {
        throw new Error(`Dataset fetch failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as DatasetRecord[];
};

/**
 * Everything the app assumes about a catalogue row, checked before anything is
 * written anywhere.
 *
 * These assertions used to live in `src/services/exercise-catalogue.test.ts`,
 * where they guarded a generated JSON file that no longer exists. They belong
 * wherever the data is produced: a malformed dataset should fail the seed run,
 * not reach a device and fail there.
 *
 * Scoped to the entries themselves. How many there ought to be depends on
 * whether the caller asked for a subset, which only the caller knows.
 */
export const validateEntries = (entries: CatalogueEntry[]): string[] => {
    const problems: string[] = [];
    const seen = new Map<string, number>();

    for (const [index, entry] of entries.entries()) {
        const where = `entry ${index} (${entry.id || 'no id'})`;

        if (entry.id.length !== 21) {
            problems.push(`${where}: id is ${entry.id.length} chars, expected 21`);
        }

        const firstSeen = seen.get(entry.id);
        if (firstSeen !== undefined) {
            problems.push(`${where}: duplicate id, first seen at entry ${firstSeen}`);
        } else {
            seen.set(entry.id, index);
        }

        if (!EXERCISE_CATEGORIES.includes(entry.category)) {
            problems.push(`${where}: category "${entry.category}" is not in the exercise enum`);
        }

        if (entry.name.trim().length === 0) problems.push(`${where}: empty name`);
        if (entry.equipment.length === 0) problems.push(`${where}: no equipment`);
        if (entry.primaryMuscleGroups.length === 0) problems.push(`${where}: no primary muscle`);
        if (entry.gifFilename.trim().length === 0) problems.push(`${where}: no gif filename`);

        const muscles = [...entry.primaryMuscleGroups, ...entry.secondaryMuscleGroups];
        const unnormalized = muscles.filter((muscle) => muscle.includes(' '));
        if (unnormalized.length > 0) {
            problems.push(`${where}: muscles not snake_case: ${unnormalized.join(', ')}`);
        }
    }

    return problems;
};
