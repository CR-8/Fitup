import { and, asc, between, eq } from 'drizzle-orm';

import { db } from '@/db';
import { waterLog, type WaterLogSelect } from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';

/** One day's drinks, oldest first, as the day timeline lists them. */
export const getWaterLogsForDate = (userId: string, date: string): Promise<WaterLogSelect[]> =>
    db
        .select()
        .from(waterLog)
        .where(and(eq(waterLog.userId, userId), eq(waterLog.date, date)))
        .orderBy(asc(waterLog.createdAt));

/** Drinks on the days `from` through `to`, both `YYYY-MM-DD` and inclusive. */
export const getWaterLogsBetween = (
    userId: string,
    from: string,
    to: string,
): Promise<WaterLogSelect[]> =>
    db
        .select()
        .from(waterLog)
        .where(and(eq(waterLog.userId, userId), between(waterLog.date, from, to)))
        .orderBy(asc(waterLog.createdAt));

export const addWaterLog = async (input: {
    id?: string;
    userId: string;
    date: string;
    amountMl: number;
}): Promise<WaterLogSelect> => {
    const row: WaterLogSelect = {
        id: input.id ?? nanoid(),
        userId: input.userId,
        date: input.date,
        amountMl: Math.round(input.amountMl),
        createdAt: new Date(),
    };

    await db.insert(waterLog).values(row);

    return row;
};

export const deleteWaterLog = async (id: string): Promise<void> => {
    await db.delete(waterLog).where(eq(waterLog.id, id));
};
