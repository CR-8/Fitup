import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
    meal,
    type MealInsert,
    mealItem,
    type MealItemInsert,
    type MealItemSelect,
    type MealSelect,
    type MealSlot,
} from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';

import { queueSyncOperations } from '../sync';
import type { MealWithItems } from './totals';

export * from './totals';

const now = () => new Date();

export const getMealsForDate = async (userId: string, date: string): Promise<MealWithItems[]> => {
    const meals = await db
        .select()
        .from(meal)
        .where(and(eq(meal.userId, userId), eq(meal.date, date)))
        .orderBy(asc(meal.createdAt));

    if (meals.length === 0) return [];

    const items = await db
        .select()
        .from(mealItem)
        .where(
            inArray(
                mealItem.mealId,
                meals.map((entry) => entry.id),
            ),
        )
        .orderBy(asc(mealItem.order));

    const byMeal = items.reduce<Record<string, MealItemSelect[]>>((acc, item) => {
        (acc[item.mealId] ??= []).push(item);
        return acc;
    }, {});

    return meals.map((entry) => ({ meal: entry, items: byMeal[entry.id] ?? [] }));
};

export interface CreateMealInput {
    userId: string;
    date: string;
    slot: MealSlot;
    planId?: string | null;
}

export const createMeal = async (input: CreateMealInput): Promise<MealSelect> => {
    const row: MealInsert = {
        id: nanoid(),
        userId: input.userId,
        date: input.date,
        slot: input.slot,
        planId: input.planId ?? null,
        notes: null,
        createdAt: now(),
        updatedAt: now(),
    };

    await db.insert(meal).values(row);

    await queueSyncOperations([
        {
            tableName: 'meal',
            recordId: row.id!,
            operation: 'create',
            data: row as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);

    return row as MealSelect;
};

/** Reuses the slot's meal for the day when one exists, so slots stay unique. */
export const getOrCreateMeal = async (input: CreateMealInput): Promise<MealSelect> => {
    const [existing] = await db
        .select()
        .from(meal)
        .where(
            and(
                eq(meal.userId, input.userId),
                eq(meal.date, input.date),
                eq(meal.slot, input.slot),
            ),
        )
        .limit(1);

    return existing ?? (await createMeal(input));
};

export interface CreateMealItemInput {
    mealId: string;
    name: string;
    quantity?: string | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    order?: number;
    consumedAt?: Date | null;
}

export const createMealItems = async (inputs: CreateMealItemInput[]): Promise<MealItemSelect[]> => {
    if (inputs.length === 0) return [];

    const rows: MealItemInsert[] = inputs.map((input, index) => ({
        id: nanoid(),
        mealId: input.mealId,
        name: input.name,
        quantity: input.quantity ?? null,
        calories: input.calories ?? null,
        proteinG: input.proteinG ?? null,
        carbsG: input.carbsG ?? null,
        fatG: input.fatG ?? null,
        consumedAt: input.consumedAt ?? null,
        order: input.order ?? index,
        createdAt: now(),
        updatedAt: now(),
    }));

    await db.insert(mealItem).values(rows);

    await queueSyncOperations(
        rows.map((row) => ({
            tableName: 'meal_item',
            recordId: row.id!,
            operation: 'create' as const,
            data: row as unknown as Record<string, unknown>,
            timestamp: now(),
        })),
    );

    return rows as MealItemSelect[];
};

/** Ticking an item off is the core logging action, so it gets its own path. */
export const setMealItemConsumed = async (id: string, consumed: boolean): Promise<void> => {
    const updates = { consumedAt: consumed ? now() : null, updatedAt: now() };

    await db.update(mealItem).set(updates).where(eq(mealItem.id, id));

    await queueSyncOperations([
        {
            tableName: 'meal_item',
            recordId: id,
            operation: 'update',
            data: updates as unknown as Record<string, unknown>,
            timestamp: now(),
        },
    ]);
};

export const deleteMealItem = async (id: string): Promise<void> => {
    await db.delete(mealItem).where(eq(mealItem.id, id));

    await queueSyncOperations([
        {
            tableName: 'meal_item',
            recordId: id,
            operation: 'delete',
            data: null,
            timestamp: now(),
        },
    ]);
};

export const deleteMeal = async (id: string): Promise<void> => {
    await db.delete(mealItem).where(eq(mealItem.mealId, id));
    await db.delete(meal).where(eq(meal.id, id));

    await queueSyncOperations([
        { tableName: 'meal', recordId: id, operation: 'delete', data: null, timestamp: now() },
    ]);
};

/** Removes every meal a plan created. Hand-entered meals are left alone. */
export const deleteMealsForPlan = async (planId: string): Promise<void> => {
    const meals = await db.select({ id: meal.id }).from(meal).where(eq(meal.planId, planId));

    for (const entry of meals) {
        try {
            await deleteMeal(entry.id);
        } catch (error) {
            reportError(error, 'Failed to remove a meal created by an AI plan');
        }
    }
};
