/**
 * Builds the bundled exercise catalogue from the open exercises-dataset.
 *
 *   bun run exercises
 *
 * Source: https://github.com/hasaneyldrm/exercises-dataset
 *
 * Licensing, which drives what this script does and does not do:
 *
 *   - The exercise DATA (names, body parts, equipment, muscles, and the
 *     multilingual instructions) is MIT licensed. That is what we import and
 *     commit here.
 *   - The exercise MEDIA (the GIFs and thumbnails) is NOT MIT. It is
 *     © Gym visual, redistributed in that repository under a written permission
 *     granted to its author, capped at 180x180, and its NOTICE states plainly
 *     that cloning the repository grants no rights to the media.
 *
 * So this script imports data only. It records each record's media filename so
 * the client can resolve an image once you host media you have the right to
 * serve, but it never downloads or vendors the media itself.
 */
import { createHash } from 'node:crypto';

import fs from 'fs-extra';

const DATASET_RAW_BASE =
    'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data';

const OUTPUT_DIRECTORY = './assets/exercises';

/** Locales the app ships. The dataset carries ten; the rest are dead weight. */
const LOCALES = ['en', 'es', 'hi', 'ru', 'zh'] as const;
type Locale = (typeof LOCALES)[number];

interface DatasetRecord {
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
type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'yoga' | 'pilates' | 'other';

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
const buildStableId = (record: DatasetRecord): string =>
    createHash('sha1')
        .update(`exercises-dataset:${record.id}:${record.media_id}`)
        .digest('base64url')
        .slice(0, 21);

/** The dataset's body part is anatomical; the local category is a training modality. */
const resolveCategory = (bodyPart: string): ExerciseCategory =>
    bodyPart === 'cardio' ? 'cardio' : 'strength';

/** "hip flexors" -> "hip_flexors", matching the app's muscle vocabulary. */
const normalizeMuscle = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, '_');

const uniq = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const toCatalogueEntry = (record: DatasetRecord): CatalogueEntry => ({
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

const fetchDataset = async (): Promise<DatasetRecord[]> => {
    const response = await fetch(`${DATASET_RAW_BASE}/exercises.json`);

    if (!response.ok) {
        throw new Error(`Dataset fetch failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as DatasetRecord[];
};

const generate = async () => {
    console.log('Fetching exercises-dataset…');
    const dataset = await fetchDataset();
    console.log(`  ${dataset.length} records`);

    await fs.ensureDir(OUTPUT_DIRECTORY);

    const entries = dataset.map(toCatalogueEntry);

    const duplicates = entries.length - new Set(entries.map((entry) => entry.id)).size;
    if (duplicates > 0) {
        throw new Error(`Refusing to write: ${duplicates} duplicate ids generated`);
    }

    await fs.writeFile(
        `${OUTPUT_DIRECTORY}/catalogue.json`,
        JSON.stringify(entries, null, 0),
        'utf8',
    );
    console.log(`  catalogue.json: ${entries.length} entries`);

    // Instructions are split per locale so seeding only parses the language in use.
    for (const locale of LOCALES) {
        const instructions: Record<string, string[]> = {};

        for (const record of dataset) {
            const steps = record.instruction_steps[locale] ?? record.instruction_steps.en;
            if (steps?.length) instructions[buildStableId(record)] = steps;
        }

        await fs.writeFile(
            `${OUTPUT_DIRECTORY}/instructions.${locale}.json`,
            JSON.stringify(instructions, null, 0),
            'utf8',
        );
        console.log(`  instructions.${locale}.json: ${Object.keys(instructions).length} entries`);
    }

    // The media stays with its owner; record the terms next to the data we ship.
    await fs.writeFile(
        `${OUTPUT_DIRECTORY}/ATTRIBUTION.md`,
        `# Exercise catalogue attribution

Exercise data in this directory is derived from
[exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(© Hasan Emir Yıldırım), used under the MIT License. The data covers exercise
names, body parts, equipment, muscle groups, and instructions.

## Media is NOT included here

The animation GIFs and thumbnails that accompany that dataset are **not** MIT
licensed and are **not** vendored into this repository. They are:

> © Gym visual — https://gymvisual.com/

distributed at 180x180 under a written permission granted to the dataset author.
Per that dataset's NOTICE, cloning it grants no rights to the media.

To show exercise animations you must obtain your own rights from Gym visual
(https://gymvisual.com/content/3-terms-and-conditions-of-use), host the media
yourself, and point \`EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL\` at it. Any use must
keep the attribution "© Gym visual — https://gymvisual.com/" visible.

Regenerate this directory with \`bun run exercises\`.
`,
        'utf8',
    );

    console.log('Done. Media intentionally not downloaded — see ATTRIBUTION.md.');
};

generate().catch((error) => {
    console.error('Failed to generate exercise catalogue:', error);
    process.exitCode = 1;
});
