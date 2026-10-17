import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { awardEarned, type AwardEarnedSelect } from '@/db/schema';

import { queueSyncOperation } from '../sync';

/** Every award this person has earned, newest first. */
export const getEarnedAwards = (userId: string): Promise<AwardEarnedSelect[]> =>
    db
        .select()
        .from(awardEarned)
        .where(eq(awardEarned.userId, userId))
        .orderBy(desc(awardEarned.createdAt));

/**
 * Records an award for its period. Returns the row when it is new, or null when
 * this award was already recorded for the period (the id is deterministic, so
 * the insert simply does nothing).
 */
export const recordAward = async (input: {
    userId: string;
    awardId: string;
    period: string;
    value: number;
}): Promise<AwardEarnedSelect | null> => {
    const now = new Date();
    const row: AwardEarnedSelect = {
        id: `${input.userId}_${input.awardId}_${input.period}`,
        ...input,
        value: Math.round(input.value),
        createdAt: now,
        updatedAt: now,
    };

    const inserted = await db.insert(awardEarned).values(row).onConflictDoNothing().returning();
    if (inserted.length === 0) return null;

    await queueSyncOperation({
        tableName: 'award_earned',
        recordId: row.id,
        operation: 'create',
        timestamp: now,
        data: row,
    });

    return row;
};
