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
 * Today's dashboard, for the period picked at the top: water, distance (from
 * Health), sessions and calories. Each chart splits the period so far into
 * buckets: 3-hour blocks for today, days for the week and month, months for
 * the year.
 */

/** Each figure's accent, the one colour its numbers and charts are drawn in. */
export const ACCENT = {
    water: '#FF6F91',
    distance: '#D6F25A',
    steps: '#A78BFA',
    sessions: '#FF9F0A',
    minutes: '#FFD60A',
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
    const meals = useMealsBetween(from, to);
    const { profile } = useAiProfile();
    const overrides = useCaloriesStore((state) => state.overrides);
    const daily = profile?.dailyCalorieTarget ?? 0;

    return useMemo(() => {
        const byDate: Record<string, MealWithItems[]> = {};
        meals.forEach((entry) => (byDate[entry.meal.date] ??= []).push(entry));

        return {
            byDate,
            daily,
            goalFor: (date: string) =>
                overrides[date] ??
                (daily > 0 ? daily : Math.round(sumPlanned(byDate[date] ?? []).calories)),
            consumedOn: (date: string) => Math.round(sumConsumed(byDate[date] ?? []).calories),
        };
    }, [daily, meals, overrides]);
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

export const useSummary = (period: Period, today: string) => {
    const { user } = useUser();
    const { data: workouts } = useWorkouts();

    // `today` re-splits the buckets when the day rolls over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const buckets = useMemo(() => bucketsFor(period), [period, today]);
    const start = buckets[0].start;
    const end = buckets[buckets.length - 1].end;
    const from = toDateKey(start.toDate());
    const to = toDateKey(end.subtract(1, 'day').toDate());
    const current = Math.max(indexOf(buckets, dayjs()), 0);

    const { data: logs } = useWaterBetween(from, to);
    const calorieDays = useCalorieDays(from, to);

    const water = useMemo(() => {
        const series = buckets.map(() => 0);
        (logs ?? []).forEach((log) => {
            // Hours come from when it was logged; anything longer from the day it counts for.
            const at = period === 'today' ? dayjs(log.createdAt) : dayjs(log.date);
            const index = indexOf(buckets, at);
            if (index >= 0) series[index] += log.amountMl;
        });

        return { series, litres: series.reduce((sum, ml) => sum + ml, 0) / 1000 };
    }, [buckets, logs, period]);

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
    const distance = health?.meters;
    const steps = health?.steps;

    const miles = user?.distanceUnits === 'mi';
    const perUnit = miles ? 1609.344 : 1000;

    const sessions = useMemo(() => {
        const list = workouts ?? [];
        const inRange = (date: Date | string | null | undefined) =>
            !!date && !dayjs(date).isBefore(start) && dayjs(date).isBefore(end);
        const startOfToday = dayjs().startOf('day');
        const completed = list.filter((w) => w.status === 'completed' && inRange(w.completedAt));
        const done = buckets.map(() => 0);
        const minutes = buckets.map(() => 0);
        completed.forEach((w) => {
            const index = indexOf(buckets, dayjs(w.completedAt));
            if (index < 0) return;
            done[index] += 1;
            if (w.startedAt) minutes[index] += dayjs(w.completedAt).diff(w.startedAt, 'minute');
        });

        return {
            series: { done, minutes },
            done: completed.length,
            planned: list.filter(
                (w) =>
                    (w.status === 'planned' || w.status === 'in_progress') &&
                    inRange(w.startAt) &&
                    !dayjs(w.startAt).isBefore(startOfToday),
            ).length,
            missed: getMissedWorkouts(list).filter((w) => inRange(w.startAt)).length,
        };
    }, [buckets, end, start, workouts]);

    // Each day of the period so far, against that day's goal.
    const calories = useMemo(() => {
        const days = dayjs().startOf('day').diff(start, 'day') + 1;
        let target = 0;
        let consumed = 0;
        for (let i = 0; i < days; i++) {
            const date = toDateKey(start.add(i, 'day').toDate());
            target += calorieDays.goalFor(date);
            consumed += calorieDays.consumedOn(date);
        }

        return { consumed, target, remaining: Math.max(target - consumed, 0) };
    }, [calorieDays, start]);

    return {
        current,
        water,
        distance: distance
            ? {
                  series: distance.map((meters) => meters / perUnit),
                  total: distance.reduce((sum, meters) => sum + meters, 0) / perUnit,
              }
            : null,
        steps: steps ? { series: steps, total: steps.reduce((sum, n) => sum + n, 0) } : null,
        distanceUnit: miles ? 'mi' : 'km',
        buckets,
        sessions,
        calories,
    };
};
