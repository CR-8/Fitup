import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type AwardEarnedSelect = typeof awardEarned.$inferSelect;
export type AwardEarnedInsert = typeof awardEarned.$inferInsert;

/**
 * An award, earned: one row each time, so a daily award earned on five days
 * is five rows. Written by the award tracker the moment a figure meets its
 * target, and kept even if the figure later drops (a deleted workout does not
 * take a trophy back).
 *
 * `period` is what makes an award earnable once per stretch: `once` for a
 * lifetime award, the day (`YYYY-MM-DD`) for a daily one, the week's Monday
 * for a weekly one. `id` is `<user>_<award>_<period>`, set by the device, so
 * two passes of the tracker (or two phones restoring one backup) cannot record
 * the same award twice.
 *
 * Backed up: see `award_earned` in src/services/backup/tables.ts.
 */
export const awardEarned = sqliteTable(
    'award_earned',
    {
        id: text('id').primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        awardId: text('award_id').notNull(),
        period: text('period').notNull(),
        /** The figure when it was earned, e.g. 2,140 kcal or 10 workouts. */
        value: integer('value').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [index('award_earned_user_award_idx').on(table.userId, table.awardId)],
);
