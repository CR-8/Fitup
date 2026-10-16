import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type NotificationLogSelect = typeof notificationLog.$inferSelect;
export type NotificationLogInsert = typeof notificationLog.$inferInsert;

/**
 * What the in-app Notifications list shows: reminders, plan updates and
 * milestones, newest first. Device-local on purpose: it is a record of what this
 * phone told the person, so it is not part of the account backup.
 */
export const notificationLog = sqliteTable(
    'notification_log',
    {
        id: text('id', { length: 21 }).primaryKey(),
        userId: text('user_id', { length: 21 }).notNull(),
        kind: text('kind', { enum: ['reminder', 'plan', 'milestone'] }).notNull(),
        title: text('title').notNull(),
        body: text('body'),
        /** An in-app path to open when the row is tapped, e.g. `/syn` or `/workout/<id>`. */
        path: text('path'),
        /** Null until the person has seen the list with this row in it. */
        readAt: integer('read_at', { mode: 'timestamp_ms' }),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
    },
    (table) => [index('notification_log_user_created_idx').on(table.userId, table.createdAt)],
);
