import { describe, expect, test } from '@jest/globals';

import catalogue from '../../assets/exercises/catalogue.json';
import instructionsEn from '../../assets/exercises/instructions.en.json';
import instructionsHi from '../../assets/exercises/instructions.hi.json';

/**
 * Guards the generated catalogue rather than the seeding code, which needs a live
 * SQLite handle. These assertions are what the seeder depends on being true, so a
 * bad regeneration fails here instead of on a device.
 */

interface CatalogueEntry {
    id: string;
    name: string;
    category: string;
    equipment: string[];
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    gifFilename: string;
}

const entries = catalogue as CatalogueEntry[];
const CATEGORIES = new Set(['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other']);

describe('bundled exercise catalogue', () => {
    test('is populated', () => {
        expect(entries.length).toBeGreaterThan(1000);
    });

    test('has unique ids at the width used by the rest of the schema', () => {
        const ids = entries.map((entry) => entry.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => id.length === 21)).toBe(true);
    });

    test('only uses categories the exercise table accepts', () => {
        const categories = new Set(entries.map((entry) => entry.category));

        for (const category of categories) {
            expect(CATEGORIES.has(category)).toBe(true);
        }
    });

    test('every entry carries a name, equipment and a primary muscle', () => {
        for (const entry of entries) {
            expect(entry.name.trim().length).toBeGreaterThan(0);
            expect(entry.equipment.length).toBeGreaterThan(0);
            expect(entry.primaryMuscleGroups.length).toBeGreaterThan(0);
        }
    });

    test('muscle groups are normalised to the snake_case vocabulary', () => {
        const muscles = entries.flatMap((entry) => [
            ...entry.primaryMuscleGroups,
            ...entry.secondaryMuscleGroups,
        ]);

        expect(muscles.some((muscle) => muscle.includes(' '))).toBe(false);
        expect(muscles.every((muscle) => muscle === muscle.toLowerCase())).toBe(true);
    });

    test('media filenames are basenames, not paths', () => {
        for (const entry of entries) {
            expect(entry.gifFilename).not.toContain('/');
            expect(entry.gifFilename).not.toMatch(/\.gif$/i);
        }
    });

    test('instructions are keyed by catalogue id in every shipped locale', () => {
        const ids = new Set(entries.map((entry) => entry.id));

        for (const bundle of [instructionsEn, instructionsHi] as Record<string, string[]>[]) {
            const keys = Object.keys(bundle);

            expect(keys.length).toBeGreaterThan(1000);
            expect(keys.every((key) => ids.has(key))).toBe(true);
        }
    });

    test('localised instructions actually differ from English', () => {
        const en = instructionsEn as Record<string, string[]>;
        const hi = instructionsHi as Record<string, string[]>;
        const sample = entries[0].id;

        expect(hi[sample]).toBeDefined();
        expect(hi[sample].join()).not.toBe(en[sample].join());
    });
});
