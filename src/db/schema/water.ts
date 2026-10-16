import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type WaterLogSelect = typeof waterLog.$inferSelect;
export type WaterLogInsert = typeof waterLog.$inferInsert;

/**
 * One drink the person logged. Hydration is always user-logged: nothing in the
 * app reads it from a health source.
 *
 * `date` is the local calendar day as `YYYY-MM-DD`, for the same reason as
 * `meal.date`: a glass belongs to the day it was drunk, so the day starts at
 * local midnight and does not move when the phone changes timezone.
 *
 * Device-local, like `notification_log`: not part of the account backup.
 */
export const waterLog = sqliteTable(
    'water_log',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        date: text('date', { length: 10 }).notNull(),
        amountMl: integer('amount_ml').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
    },
    (table) => [index('water_log_user_date_idx').on(table.userId, table.date)],
);
