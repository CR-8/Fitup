import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';

import { sumConsumed, sumPlanned, toDateKey, type MealWithItems } from '@/crud/nutrition';
import { getMissedWorkouts, startOfWeekMs } from '@/helpers/workouts';
import { useAiProfile } from '@/hooks/use-ai';
import { useMealsBetween } from '@/hooks/use-nutrition';
import { useUser } from '@/hooks/use-user';
import { useAppState } from '@/hooks/use-app-state';
import { useWaterBetween, useWaterSettings } from '@/hooks/use-water';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { useWorkouts } from '@/hooks/use-workouts';
import {
    HEALTH_CONNECT_STORE_URL,
    getMovementAccess,
    readMovement,
    requestHealthPermissions,
} from '@/services/health';
import { reportError } from '@/services/error-reporting';
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

// ponytail: one fixed daily distance goal; make it a setting if people ask to change it.
export const DISTANCE_GOAL = { km: 5, mi: 3 };

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

/**
 * Distance and steps from Health, by bucket. Both are null until Health can be
 * read (`access`; `connect` asks, or on Android without Health Connect opens
 * its store page); after that an empty bucket is 0. The figures are read again
 * every few minutes while on screen and whenever the app comes back, so the
 * count keeps up with a walk.
 */
export const useMovementSummary = (period: Period, today: string) => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const range = usePeriodRange(period, today);
    const { buckets, from } = range;

    const { data: access, refetch: recheck } = useQuery({
        queryKey: ['health-access'],
        queryFn: getMovementAccess,
        staleTime: 60_000,
    });

    // Buckets still ahead are zero without asking; the one under way stops at now.
    // `period` and `from` fix the buckets, which are dates and so not a key of their own.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    const { data: health, refetch } = useQuery({
        queryKey: ['health-movement', period, from],
        queryFn: async () => {
            const now = dayjs();
            const past = buckets.filter((bucket) => bucket.start.isBefore(now));
            const read = await readMovement(
                past.map((bucket) => ({
                    start: bucket.start.toDate(),
                    end: (bucket.end.isAfter(now) ? now : bucket.end).toDate(),
                })),
            );
            const pad = (values: number[] | null) =>
                values && buckets.map((_, i) => values[i] ?? 0);

            return { steps: pad(read.steps), meters: pad(read.meters) };
        },
        enabled: access === 'granted',
        staleTime: 60_000,
        refetchInterval: 3 * 60_000,
    });

    useAppState({
        onForeground: () => {
            void recheck();
            if (access === 'granted') void refetch();
        },
    });

    const connect = useCallback(async () => {
        try {
            if (access === 'install') {
                await Linking.openURL(HEALTH_CONNECT_STORE_URL);
                return;
            }
            await requestHealthPermissions();
        } catch (error) {
            reportError(error, 'Failed to connect Health for steps:');
        }
        await queryClient.invalidateQueries({ queryKey: ['health-access'] });
        await queryClient.invalidateQueries({ queryKey: ['health-movement'] });
    }, [access, queryClient]);

    const miles = user?.distanceUnits === 'mi';
    const perUnit = miles ? 1609.344 : 1000;
    const granted = access === 'granted';
    const meters = granted ? health?.meters : null;
    const steps = granted ? health?.steps : null;

    return {
        ...range,
        // Undefined while it is first checked.
        access,
        connect,
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

/** Every `YYYY-MM-DD` from `from` through `to`. */
const daysBetween = (from: string, to: string): string[] => {
    const days: string[] = [];
    for (let day = dayjs(from); !day.isAfter(dayjs(to), 'day'); day = day.add(1, 'day')) {
        days.push(toDateKey(day.toDate()));
    }

    return days;
};

/** Health windows for `days`, each cut off at now; days still ahead read as nothing. */
const readUpToNow = async (windows: { start: Dayjs; end: Dayjs }[]) => {
    const now = dayjs();
    const past = windows.filter((window) => window.start.isBefore(now));
    const read = await readMovement(
        past.map(({ start, end }) => ({
            start: start.toDate(),
            end: (end.isAfter(now) ? now : end).toDate(),
        })),
    );
    const pad = (values: number[] | null) => values && windows.map((_, i) => values[i] ?? 0);

    return { steps: pad(read.steps), meters: pad(read.meters) };
};

/**
 * Today's three rings for every day from `from` through `to`, for the activity
 * screen and its calendar: water against the goal, distance from Health
 * against DISTANCE_GOAL, and that week's sessions so far against the weekly
 * target (the dial's sessions ring is the week's, not the day's). Distance and
 * steps are null until Health can be read.
 */
export const useActivityDays = (from: string, to: string) => {
    const { user } = useUser();
    const { data: logs } = useWaterBetween(from, to);
    const { targetMl } = useWaterSettings();
    const { data: workouts } = useWorkouts();
    const { target } = useWeeklyStreak();
    const { data: access } = useQuery({
        queryKey: ['health-access'],
        queryFn: getMovementAccess,
        staleTime: 60_000,
    });
    // ponytail: one Health read per day of the range, ~90 for the calendar; batch by week if slow.
    const { data: health } = useQuery({
        queryKey: ['health-movement-days', from, to],
        queryFn: () =>
            readUpToNow(
                daysBetween(from, to).map((day) => ({
                    start: dayjs(day).startOf('day'),
                    end: dayjs(day).add(1, 'day').startOf('day'),
                })),
            ),
        enabled: access === 'granted',
        staleTime: 60_000,
    });

    return useMemo(() => {
        const days = daysBetween(from, to);
        const index = new Map(days.map((day, i) => [day, i]));
        const miles = user?.distanceUnits === 'mi';
        const perUnit = miles ? 1609.344 : 1000;
        const distanceGoal = DISTANCE_GOAL[miles ? 'mi' : 'km'];
        const firstWeekday = user?.firstWeekday || 2;
        const granted = access === 'granted';

        const waterOn: Record<string, number> = {};
        (logs ?? []).forEach(
            (log) => (waterOn[log.date] = (waterOn[log.date] ?? 0) + log.amountMl),
        );
        const completed = (workouts ?? []).filter(
            (workout) => workout.status === 'completed' && !!workout.completedAt,
        );

        const dayFor = (date: string) => {
            const end = dayjs(date).endOf('day');
            const since = startOfWeekMs(firstWeekday, end.toDate());
            const at = (workout: (typeof completed)[number]) =>
                new Date(workout.completedAt!).getTime();
            const weekSessions = completed.filter(
                (workout) => at(workout) >= since && at(workout) <= end.valueOf(),
            ).length;
            const i = index.get(date);
            const meters = granted && i !== undefined ? (health?.meters?.[i] ?? null) : null;
            const steps = granted && i !== undefined ? (health?.steps?.[i] ?? null) : null;
            const waterMl = waterOn[date] ?? 0;
            const distance = meters === null ? null : meters / perUnit;

            return {
                waterMl,
                distance,
                steps,
                sessions: completed.filter((workout) =>
                    dayjs(workout.completedAt).isSame(end, 'day'),
                ).length,
                weekSessions,
                rings: [
                    { progress: targetMl > 0 ? waterMl / targetMl : 0, color: ACCENT.water },
                    { progress: (distance ?? 0) / distanceGoal, color: ACCENT.distance },
                    { progress: target > 0 ? weekSessions / target : 0, color: ACCENT.sessions },
                ],
            };
        };

        return {
            dayFor,
            logs: logs ?? [],
            completed,
            targetMl,
            distanceGoal,
            distanceUnit: miles ? 'mi' : 'km',
            target,
            access,
        };
    }, [access, from, health, logs, target, targetMl, to, user, workouts]);
};

/** One day's steps and distance (in the person's unit) hour by hour, once Health can be read. */
export const useMovementHours = (date: string, granted: boolean) => {
    const { user } = useUser();
    const { data } = useQuery({
        queryKey: ['health-movement-hours', date],
        queryFn: () =>
            readUpToNow(
                Array.from({ length: 24 }, (_, hour) => ({
                    start: dayjs(date).startOf('day').add(hour, 'hour'),
                    end: dayjs(date)
                        .startOf('day')
                        .add(hour + 1, 'hour'),
                })),
            ),
        enabled: granted,
        staleTime: 60_000,
    });
    const perUnit = user?.distanceUnits === 'mi' ? 1609.344 : 1000;

    return {
        steps: data?.steps ?? null,
        distance: data?.meters ? data.meters.map((m) => m / perUnit) : null,
    };
};
