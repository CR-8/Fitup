import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type MealSelect = typeof meal.$inferSelect;
export type MealInsert = typeof meal.$inferInsert;

export type MealItemSelect = typeof mealItem.$inferSelect;
export type MealItemInsert = typeof mealItem.$inferInsert;

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const meal = sqliteTable(
    'meal',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        /**
         * Local calendar day as `YYYY-MM-DD`.
         *
         * A timestamp would be wrong here: a meal belongs to the day the person
         * ate it, and storing an instant makes that day shift when they travel or
         * when the device changes timezone. Workouts use timestamps because their
         * duration matters; a meal's does not.
         */
        date: text('date', { length: 10 }).notNull(),
        slot: text('slot', { enum: MEAL_SLOTS }).notNull(),
        /** The AI plan this meal came from, when it was not entered by hand. */
        planId: text('plan_id', { length: 21 }),
        notes: text('notes'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('meal_user_date_idx').on(table.userId, table.date),
        index('meal_plan_idx').on(table.planId),
    ],
);

/**
 * A single food entry.
 *
 * Macros are stored on the item rather than joined from a food catalogue,
 * because there is no such catalogue: entries come either from a generated plan
 * or from the user typing them. Keeping them here means an item is meaningful on
 * its own and a later catalogue can be added without rewriting history.
 */
export const mealItem = sqliteTable(
    'meal_item',
    {
        id: text('id', { length: 21 }).primaryKey(),
        mealId: text('meal_id', { length: 21 }).notNull(),
        name: text('name').notNull(),
        /** Free text, e.g. "150 g" or "1 cup" — deliberately not parsed. */
        quantity: text('quantity'),
        calories: real('calories'),
        proteinG: real('protein_g'),
        carbsG: real('carbs_g'),
        fatG: real('fat_g'),
        /** Set once the user confirms they actually ate it. */
        consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
        order: integer('order').notNull().default(0),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [index('meal_item_meal_order_idx').on(table.mealId, table.order)],
);
