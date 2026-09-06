import dayjs from 'dayjs';

import type { MealItemSelect, MealSelect } from '@/db/schema';

/**
 * Pure day arithmetic, deliberately free of any database import so it can be
 * exercised without a SQLite handle.
 */

export interface MealWithItems {
    meal: MealSelect;
    items: MealItemSelect[];
}

export interface DayTotals {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
}

const EMPTY: DayTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Local calendar day key. Meals belong to a day, not to an instant. */
export const toDateKey = (date: Date = new Date()): string => dayjs(date).format('YYYY-MM-DD');

const total = (items: MealItemSelect[]): DayTotals =>
    items.reduce<DayTotals>(
        (totals, item) => ({
            calories: totals.calories + (item.calories ?? 0),
            proteinG: totals.proteinG + (item.proteinG ?? 0),
            carbsG: totals.carbsG + (item.carbsG ?? 0),
            fatG: totals.fatG + (item.fatG ?? 0),
        }),
        EMPTY,
    );

/** Totals for items actually eaten; planned-but-unticked entries are excluded. */
export const sumConsumed = (meals: MealWithItems[]): DayTotals =>
    total(meals.flatMap((entry) => entry.items).filter((item) => item.consumedAt != null));

/** Totals for everything planned for the day, eaten or not. */
export const sumPlanned = (meals: MealWithItems[]): DayTotals =>
    total(meals.flatMap((entry) => entry.items));

export interface DayItemCounts {
    /** Every food entry on the day, planned or eaten. */
    total: number;
    /** Those ticked off as actually eaten. */
    consumed: number;
}

/**
 * How much of the day has been worked through, counted in entries.
 *
 * The macro sums answer "how much", this answers "how far" — and it is what
 * decides whether the screen has anything worth showing at all. A day with a
 * generated chart but nothing ticked has `total > 0` and `consumed === 0`,
 * which is a real state and reads very differently from an empty day.
 */
export const countDayItems = (meals: MealWithItems[]): DayItemCounts => {
    const items = meals.flatMap((entry) => entry.items);

    return {
        total: items.length,
        consumed: items.filter((item) => item.consumedAt != null).length,
    };
};
