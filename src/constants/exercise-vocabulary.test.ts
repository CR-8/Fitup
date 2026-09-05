import { describe, expect, test } from '@jest/globals';

import common from '@/locale/resources/en/common.json';
import { equipmentTranslationKey } from '@/constants/equipment';
import { normalizeMuscleValue } from '@/constants/muscles';

/**
 * Guards the seam between the exercise dataset's vocabulary and ours.
 *
 * The catalogue is seeded from an open dataset that names things its own way —
 * `quadriceps` where we say `quads`, `delts` where we say `shoulders`, and
 * `ez barbell` with a space in it. A value we have no key for does not fail
 * loudly: i18next returns the key, so the muscle chip on the guide reads
 * "delts" and nobody notices until a user does.
 *
 * These are the values actually present in the seeded catalogue, read off the
 * shipped database. Growing the dataset is expected to grow these lists — the
 * point is that adding a value forces a decision here rather than shipping a
 * raw key to the screen.
 */

const MUSCLE_VALUES = [
    'abdominals',
    'abductors',
    'abs',
    'adductors',
    'ankle_stabilizers',
    'ankles',
    'back',
    'biceps',
    'brachialis',
    'calves',
    'cardio',
    'cardiovascular_system',
    'chest',
    'core',
    'deltoids',
    'delts',
    'feet',
    'forearms',
    'glutes',
    'grip_muscles',
    'groin',
    'hamstrings',
    'hands',
    'hip_flexors',
    'inner_thighs',
    'latissimus_dorsi',
    'lats',
    'levator_scapulae',
    'lower_abs',
    'lower_arms',
    'lower_back',
    'lower_legs',
    'neck',
    'obliques',
    'pectorals',
    'quadriceps',
    'quads',
    'rear_deltoids',
    'rhomboids',
    'rotator_cuff',
    'serratus_anterior',
    'shins',
    'shoulders',
    'soleus',
    'spine',
    'sternocleidomastoid',
    'trapezius',
    'traps',
    'triceps',
    'upper_arms',
    'upper_back',
    'upper_chest',
    'upper_legs',
    'waist',
    'wrist_extensors',
    'wrist_flexors',
    'wrists',
];

const EQUIPMENT_VALUES = [
    'assisted',
    'band',
    'barbell',
    'body weight',
    'bosu ball',
    'cable',
    'dumbbell',
    'elliptical machine',
    'ez barbell',
    'hammer',
    'kettlebell',
    'leverage machine',
    'medicine ball',
    'olympic barbell',
    'resistance band',
    'roller',
    'rope',
    'skierg machine',
    'sled machine',
    'smith machine',
    'stability ball',
    'stationary bike',
    'stepmill machine',
    'tire',
    'trap bar',
    'upper body ergometer',
    'weighted',
    'wheel roller',
];

describe('muscle vocabulary', () => {
    test('every catalogue value resolves to a translation key', () => {
        const unresolved = MUSCLE_VALUES.filter((value) => {
            const normalized = normalizeMuscleValue(value);
            return !normalized || !(normalized in common.muscleGroup);
        });

        expect(unresolved).toEqual([]);
    });

    test('all 57 values are covered', () => {
        expect(MUSCLE_VALUES).toHaveLength(57);
    });
});

describe('equipment vocabulary', () => {
    test('every catalogue value resolves to a translation key', () => {
        const unresolved = EQUIPMENT_VALUES.filter(
            (value) => !(equipmentTranslationKey(value) in common.equipment),
        );

        expect(unresolved).toEqual([]);
    });

    test('spaces become underscores rather than reaching i18next raw', () => {
        expect(equipmentTranslationKey('upper body ergometer')).toBe('upper_body_ergometer');
        expect(equipmentTranslationKey('  EZ Barbell  ')).toBe('ez_barbell');
    });
});
