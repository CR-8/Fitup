import { describe, expect, test } from '@jest/globals';

import { countDayItems, sumConsumed, sumPlanned, toDateKey, type MealWithItems } from './totals';
import type { MealItemSelect, MealSelect } from '@/db/schema';

const buildItem = (overrides: Partial<MealItemSelect>): MealItemSelect =>
    ({
        id: 'item',
        mealId: 'meal',
        name: 'Oats',
        quantity: null,
        calories: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        consumedAt: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }) as MealItemSelect;

const buildMeal = (items: MealItemSelect[]): MealWithItems => ({
    meal: { id: 'meal', slot: 'breakfast' } as MealSelect,
    items,
});

describe('daily totals', () => {
    test('counts only items that were ticked off as consumed', () => {
        const meals = [
            buildMeal([
                buildItem({ id: 'a', calories: 300, proteinG: 20, consumedAt: new Date() }),
                // Planned by a generated chart but not yet eaten.
                buildItem({ id: 'b', calories: 500, proteinG: 40 }),
            ]),
        ];

        expect(sumConsumed(meals)).toEqual({
            calories: 300,
            proteinG: 20,
            carbsG: 0,
            fatG: 0,
        });
    });

    test('planned totals include everything on the day, eaten or not', () => {
        const meals = [
            buildMeal([
                buildItem({ id: 'a', calories: 300, consumedAt: new Date() }),
                buildItem({ id: 'b', calories: 500 }),
            ]),
        ];

        expect(sumPlanned(meals).calories).toBe(800);
    });

    test('treats missing macros as zero rather than producing NaN', () => {
        const meals = [buildMeal([buildItem({ id: 'a', consumedAt: new Date() })])];

        const totals = sumConsumed(meals);

        expect(Number.isNaN(totals.calories)).toBe(false);
        expect(totals).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    });

    test('adds up across several meals', () => {
        const meals = [
            buildMeal([buildItem({ id: 'a', calories: 300, fatG: 10, consumedAt: new Date() })]),
            buildMeal([buildItem({ id: 'b', calories: 700, fatG: 25, consumedAt: new Date() })]),
        ];

        expect(sumConsumed(meals)).toMatchObject({ calories: 1000, fatG: 35 });
    });

    test('an empty day totals zero', () => {
        expect(sumConsumed([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
    });
});

/**
 * These counts decide which of the nutrition screen's three states renders, so
 * getting them wrong shows an empty-day setup card to someone holding a full
 * meal plan — or a progress panel to someone with nothing logged.
 */
describe('counting the day', () => {
    test('separates what is planned from what was eaten', () => {
        const meals = [
            buildMeal([
                buildItem({ id: 'a', consumedAt: new Date() }),
                buildItem({ id: 'b' }),
                buildItem({ id: 'c' }),
            ]),
        ];

        expect(countDayItems(meals)).toEqual({ total: 3, consumed: 1 });
    });

    test('a generated chart nobody has touched counts as planned, not eaten', () => {
        const meals = [buildMeal([buildItem({ id: 'a' }), buildItem({ id: 'b' })])];

        expect(countDayItems(meals)).toEqual({ total: 2, consumed: 0 });
    });

    test('counts across meals', () => {
        const meals = [
            buildMeal([buildItem({ id: 'a', consumedAt: new Date() })]),
            buildMeal([buildItem({ id: 'b', consumedAt: new Date() }), buildItem({ id: 'c' })]),
        ];

        expect(countDayItems(meals)).toEqual({ total: 3, consumed: 2 });
    });

    test('an empty day counts zero', () => {
        expect(countDayItems([])).toEqual({ total: 0, consumed: 0 });
    });
});

describe('toDateKey', () => {
    test('formats a local calendar day, not an instant', () => {
        expect(toDateKey(new Date(2026, 7, 9, 23, 30))).toBe('2026-08-09');
    });

    test('does not roll over to the next day late in the evening', () => {
        // A timestamp-based key in UTC would report the 10th here for many zones.
        expect(toDateKey(new Date(2026, 0, 31, 22, 0))).toBe('2026-01-31');
    });
});
