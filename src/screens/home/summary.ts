import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';

import { sumConsumed, sumPlanned, toDateKey, type MealWithItems } from '@/crud/nutrition';
import { getMissedWorkouts } from '@/helpers/workouts';
import { useAiProfile } from '@/hooks/use-ai';
import { useMealsBetween } from '@/hooks/use-nutrition';
import { useUser } from '@/hooks/use-user';
import { useWaterBetween } from '@/hooks/use-water';
import { useWorkouts } from '@/hooks/use-workouts';
import { readDistanceMeters, readStepCount } from '@/services/health';
import { useCaloriesStore } from '@/stores/calories';

/**
 * Today's dashboard, for the period each card picks: water, distance (from
 * Health) and sessions. Each chart splits the period so far into
 * buckets: 3-hour blocks for today, days for the week and month, months for
 * the year.
 */

/** Each figure's accent, the one colour its numbers and charts are drawn in. */
export const ACCENT = {
    // The hydration blue, so water is one colour on Today, its chart and its screen.
    water: '#4AA8FF',
    distance: '#D6F25A',
    steps: '#A78BFA',
    sessions: '#FF9F0A',
    calories: '#5AB0FF',
};

export type Period = 'today' | 'week' | 'month' | 'year';
export const PERIODS: Period[] = ['today', 'week', 'month', 'year'];

interface Bucket {
    start: Dayjs;
    end: Dayjs;
}

export const bucketsFor = (period: Period, now: Dayjs = dayjs()): Bucket[] => {
    const start = now.startOf(period === 'today' ? 'day' : period);
    const [count, unit, step]: [number, 'hour' | 'day' | 'month', number] =
        period === 'today'
            ? [8, 'hour', 3]
            : period === 'year'
              ? [12, 'month', 1]
              : [period === 'week' ? 7 : now.daysInMonth(), 'day', 1];

    return Array.from({ length: count }, (_, i) => ({
        start: start.add(i * step, unit),
        end: start.add((i + 1) * step, unit),
    }));
};

/**
 * Calories eaten and the goal, day by day, from `from` through `to`. A day's
 * goal is the one adjusted for that day, else the profile's daily goal, else
 * what the day's meal plan adds up to.
 */
export const useCalorieDays = (from: string, to: string) => {
    const { meals, isFetched } = useMealsBetween(from, to);
    const { profile } = useAiProfile();
    const overrides = useCaloriesStore((state) => state.overrides);
    const daily = profile?.dailyCalorieTarget ?? 0;

    return useMemo(() => {
        const byDate: Record<string, MealWithItems[]> = {};
        meals.forEach((entry) => (byDate[entry.meal.date] ??= []).push(entry));

        return {
            byDate,
            isFetched,
            daily,
            goalFor: (date: string) =>
                overrides[date] ??
                (daily > 0 ? daily : Math.round(sumPlanned(byDate[date] ?? []).calories)),
            consumedOn: (date: string) => Math.round(sumConsumed(byDate[date] ?? []).calories),
        };
    }, [daily, isFetched, meals, overrides]);
};

/**
 * Each bucket's x for a chart with axes: named blocks, weekdays and months as
 * categories, the month's days as numbers (so the axis spaces them out); and
 * the labels Android draws itself, a week apart in a month.
 */
export const axisFor = (period: Period, buckets: Bucket[], locale: string) => {
    const x = buckets.map(({ start }, i) =>
        period === 'month'
            ? i + 1
            : start
                  .locale(locale)
                  .format(period === 'today' ? 'hA' : period === 'week' ? 'ddd' : 'MMM'),
    );

    return { x, ticks: x.map((value, i) => (period === 'month' && i % 7 ? '' : String(value))) };
};

const indexOf = (buckets: Bucket[], at: Dayjs) =>
    buckets.findIndex((bucket) => !at.isBefore(bucket.start) && at.isBefore(bucket.end));

/** The period's buckets and date range; `today` re-splits them when the day rolls over. */
const usePeriodRange = (period: Period, today: string) =>
    useMemo(() => {
        const buckets = bucketsFor(period);
        const start = buckets[0].start;
        const end = buckets[buckets.length - 1].end;

        return {
            buckets,
            start,
            end,
            from: toDateKey(start.toDate()),
            to: toDateKey(end.subtract(1, 'day').toDate()),
            current: Math.max(indexOf(buckets, dayjs()), 0),
        };
        // `today` is not read, but it is what moves the buckets on at midnight.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, today]);

/** Litres drunk in the period, by bucket. */
export const useWaterSummary = (period: Period, today: string) => {
    const range = usePeriodRange(period, today);
    const { data: logs } = useWaterBetween(range.from, range.to);

    const water = useMemo(() => {
        const series = range.buckets.map(() => 0);
        (logs ?? []).forEach((log) => {
            // Hours come from when it was logged; anything longer from the day it counts for.
            const at = period === 'today' ? dayjs(log.createdAt) : dayjs(log.date);
            const index = indexOf(range.buckets, at);
            if (index >= 0) series[index] += log.amountMl;
        });

        return { series, litres: series.reduce((sum, ml) => sum + ml, 0) / 1000 };
    }, [range, logs, period]);

    return { ...range, water };
};

/** Distance and steps from Health, by bucket; null where Health has nothing. */
export const useMovementSummary = (period: Period, today: string) => {
    const { user } = useUser();
    const range = usePeriodRange(period, today);
    const { buckets, from } = range;

    // One Health read per bucket and figure; buckets still ahead are zero without asking.
    // `period` and `from` fix the buckets, which are dates and so not a key of their own.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const { data: health } = useQuery({
        queryKey: ['health-distance', period, from],
        queryFn: async () => {
            const now = dayjs();
            const read = async (reader: typeof readStepCount) => {
                const values = await Promise.all(
                    buckets.map((bucket) =>
                        bucket.start.isAfter(now)
                            ? Promise.resolve(0)
                            : reader(
                                  bucket.start.toDate(),
                                  (bucket.end.isAfter(now) ? now : bucket.end).toDate(),
                              ),
                    ),
                );

                return values.every((value) => value == null)
                    ? null
                    : values.map((value) => value ?? 0);
            };
            const [meters, steps] = await Promise.all([
                read(readDistanceMeters),
                read(readStepCount),
            ]);

            return { meters, steps };
        },
        staleTime: 5 * 60_000,
    });

    const miles = user?.distanceUnits === 'mi';
    const perUnit = miles ? 1609.344 : 1000;
    const meters = health?.meters;
    const steps = health?.steps;

    return {
        ...range,
        distance: meters
            ? {
                  series: meters.map((m) => m / perUnit),
                  total: meters.reduce((sum, m) => sum + m, 0) / perUnit,
              }
            : null,
        steps: steps ? { series: steps, total: steps.reduce((sum, n) => sum + n, 0) } : null,
        distanceUnit: miles ? 'mi' : 'km',
    };
};

/** Sessions done, still planned, and missed, in the period. */
export const useSessionsSummary = (period: Period, today: string) => {
    const { data: workouts } = useWorkouts();
    const { start, end } = usePeriodRange(period, today);

    return useMemo(() => {
        const list = workouts ?? [];
        const inRange = (date: Date | string | null | undefined) =>
            !!date && !dayjs(date).isBefore(start) && dayjs(date).isBefore(end);
        const startOfToday = dayjs().startOf('day');

        return {
            done: list.filter((w) => w.status === 'completed' && inRange(w.completedAt)).length,
            planned: list.filter(
                (w) =>
                    (w.status === 'planned' || w.status === 'in_progress') &&
                    inRange(w.startAt) &&
                    !dayjs(w.startAt).isBefore(startOfToday),
            ).length,
            missed: getMissedWorkouts(list).filter((w) => inRange(w.startAt)).length,
        };
    }, [end, start, workouts]);
};
