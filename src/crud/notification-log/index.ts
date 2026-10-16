import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { notificationLog, type NotificationLogSelect } from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const LIST_LIMIT = 100;

export type NotificationKind = NotificationLogSelect['kind'];

/**
 * Records something the app told the person, for the Notifications list.
 *
 * A row with the same title and body in the last two minutes is not written
 * again: the same push can be seen when it arrives and again when it is tapped.
 * Never throws; a log that cannot be written must not break what raised it.
 */
export const logNotification = async (input: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body?: string | null;
    path?: string | null;
}): Promise<void> => {
    try {
        const recent = await db
            .select({ id: notificationLog.id, body: notificationLog.body })
            .from(notificationLog)
            .where(
                and(
                    eq(notificationLog.userId, input.userId),
                    eq(notificationLog.title, input.title),
                    gt(notificationLog.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS)),
                ),
            );

        if (recent.some((row) => (row.body ?? null) === (input.body ?? null))) return;

        await db.insert(notificationLog).values({
            id: nanoid(),
            userId: input.userId,
            kind: input.kind,
            title: input.title,
            body: input.body ?? null,
            path: input.path ?? null,
        });
    } catch (error) {
        reportError(error, 'Failed to write the notification log:');
    }
};

export const getNotifications = (userId: string): Promise<NotificationLogSelect[]> =>
    db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.userId, userId))
        .orderBy(desc(notificationLog.createdAt))
        .limit(LIST_LIMIT);

export const countUnreadNotifications = async (userId: string): Promise<number> => {
    const [row] = await db
        .select({ value: count() })
        .from(notificationLog)
        .where(and(eq(notificationLog.userId, userId), isNull(notificationLog.readAt)));

    return row?.value ?? 0;
};

export const markNotificationsRead = async (userId: string): Promise<void> => {
    await db
        .update(notificationLog)
        .set({ readAt: new Date() })
        .where(and(eq(notificationLog.userId, userId), isNull(notificationLog.readAt)));
};
