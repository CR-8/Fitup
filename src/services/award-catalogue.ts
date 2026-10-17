import { storage } from '@/storage';

import { supabase } from './supabase';

/**
 * Which awards exist, and what each one asks for.
 *
 * The app ships `BUILT_IN_AWARDS`. The CMS (cms-payload, Awards) publishes to
 * Supabase's `catalogue_awards`, which this reads into MMKV and lays over the
 * built-ins by id: a published row edits a built-in award or adds a new one,
 * and an inactive row hides one. Offline, signed out or with no backend, the
 * last copy read (or the built-ins alone) is what the app shows.
 */

/** The figures an award can be measured on; the app knows how to read each. */
export const AWARD_METRICS = [
    'calories_today',
    'calorie_goal_days',
    'water_today',
    'water_goal_days',
    'workouts_total',
    'workouts_week',
    'streak_days',
] as const;
export type AwardMetric = (typeof AWARD_METRICS)[number];

export const AWARD_SHAPES = ['circle', 'square', 'diamond'] as const;
export const AWARD_SYMBOLS = [
    'flame',
    'target',
    'drop',
    'dumbbell',
    'trophy',
    'calendar',
    'bolt',
] as const;

export type AwardShape = (typeof AWARD_SHAPES)[number];
export type AwardSymbol = (typeof AWARD_SYMBOLS)[number];
export type AwardGroup = 'daily' | 'workouts';
export type AwardRepeat = 'once' | 'daily' | 'weekly';

export interface AwardDefinition {
    id: string;
    metric: AwardMetric;
    /** Null: the person's own goal for the metric. */
    target: number | null;
    repeat: AwardRepeat;
    group: AwardGroup;
    shape: AwardShape;
    symbol: AwardSymbol;
    color: string;
    /** By locale. Absent on built-ins, which take their words from the app's translations. */
    name?: Record<string, string>;
    description?: Record<string, string>;
    sortOrder: number;
    isActive: boolean;
}

const CALORIES = '#5AB0FF';
const WATER = '#FF6F91';
const WORKOUTS = '#D6F25A';
const WEEK = '#FF9F0A';

const builtIn = (
    id: string,
    sortOrder: number,
    fields: Omit<AwardDefinition, 'id' | 'sortOrder' | 'isActive'>,
): AwardDefinition => ({ id, sortOrder, isActive: true, ...fields });

export const BUILT_IN_AWARDS: AwardDefinition[] = [
    builtIn('calorieGoal', 10, {
        metric: 'calories_today',
        target: null,
        repeat: 'daily',
        group: 'daily',
        shape: 'circle',
        symbol: 'flame',
        color: CALORIES,
    }),
    builtIn('calorieGoals100', 20, {
        metric: 'calorie_goal_days',
        target: 100,
        repeat: 'once',
        group: 'daily',
        shape: 'circle',
        symbol: 'target',
        color: CALORIES,
    }),
    builtIn('waterGoal', 30, {
        metric: 'water_today',
        target: null,
        repeat: 'daily',
        group: 'daily',
        shape: 'circle',
        symbol: 'drop',
        color: WATER,
    }),
    builtIn('waterGoals30', 40, {
        metric: 'water_goal_days',
        target: 30,
        repeat: 'once',
        group: 'daily',
        shape: 'circle',
        symbol: 'target',
        color: WATER,
    }),
    ...([1, 10, 50, 100] as const).map((target, i) =>
        builtIn(`workouts${target}`, 50 + i * 10, {
            metric: 'workouts_total',
            target,
            repeat: 'once',
            group: 'workouts',
            shape: 'square',
            symbol: target === 1 ? 'dumbbell' : 'trophy',
            color: WORKOUTS,
        }),
    ),
    builtIn('perfectWeek', 90, {
        metric: 'workouts_week',
        target: null,
        repeat: 'weekly',
        group: 'workouts',
        shape: 'diamond',
        symbol: 'calendar',
        color: WEEK,
    }),
    builtIn('sevenWorkoutWeek', 100, {
        metric: 'workouts_week',
        target: 7,
        repeat: 'weekly',
        group: 'workouts',
        shape: 'diamond',
        symbol: 'bolt',
        color: WEEK,
    }),
    builtIn('streak7', 110, {
        metric: 'streak_days',
        target: 7,
        repeat: 'once',
        group: 'workouts',
        shape: 'diamond',
        symbol: 'flame',
        color: WEEK,
    }),
];

const STORAGE_KEY = 'award-catalogue';

const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
    values.includes(value as T) ? (value as T) : fallback;

/** A `catalogue_awards` row, checked: a row naming a metric this build cannot read is dropped. */
const fromRow = (row: Record<string, unknown>): AwardDefinition | null => {
    if (typeof row.id !== 'string' || !AWARD_METRICS.includes(row.metric as AwardMetric)) {
        return null;
    }

    return {
        id: row.id,
        metric: row.metric as AwardMetric,
        target: typeof row.target === 'number' && row.target > 0 ? row.target : null,
        repeat: oneOf(['once', 'daily', 'weekly'], row.repeat, 'once'),
        group: oneOf(['daily', 'workouts'], row.award_group, 'workouts'),
        shape: oneOf(AWARD_SHAPES, row.shape, 'circle'),
        symbol: oneOf(AWARD_SYMBOLS, row.symbol, 'trophy'),
        color:
            typeof row.color === 'string' && /^#[0-9a-f]{6}$/i.test(row.color)
                ? row.color
                : WORKOUTS,
        name: (row.name as Record<string, string>) ?? undefined,
        description: (row.description as Record<string, string>) ?? undefined,
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
        isActive: row.is_active !== false,
    };
};

const readCached = (): AwardDefinition[] => {
    try {
        const raw = storage.getString(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as AwardDefinition[]) : [];
    } catch {
        return [];
    }
};

/** The built-ins with the last-read catalogue laid over them, active only, in order. */
export const readAwardCatalogue = (): AwardDefinition[] => {
    const byId = new Map(BUILT_IN_AWARDS.map((award) => [award.id, award]));
    readCached().forEach((award) => byId.set(award.id, award));

    return [...byId.values()]
        .filter((award) => award.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
};

/** Reads `catalogue_awards` into the cache. Throws on a failed read; the cache is left as it was. */
export const refreshAwardCatalogue = async (): Promise<AwardDefinition[]> => {
    if (!supabase) return readAwardCatalogue();

    const { data, error } = await supabase.from('catalogue_awards').select('*');
    if (error) throw error;

    const rows = (data ?? [])
        .map((row) => fromRow(row as Record<string, unknown>))
        .filter((award): award is AwardDefinition => award !== null);
    storage.set(STORAGE_KEY, JSON.stringify(rows));

    return readAwardCatalogue();
};
