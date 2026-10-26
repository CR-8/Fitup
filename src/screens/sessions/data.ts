import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { updateWorkout } from '@/crud/workout';
import type { WorkoutSelect } from '@/db/schema';
import { useWorkouts } from '@/hooks/use-workouts';
import { readActiveCalories } from '@/services/health';

/**
 * Finished sessions for the Sessions screen, newest first, a month at a time.
 * `all` lists every one; `workouts` and each workout name add the month's
 * totals and averages, as Apple Fitness does for a filter.
 */

export const ALL = 'all';
export const WORKOUTS = 'workouts';

const pad = (n: number) => String(n).padStart(2, '0');

/** "1:05" as hours and minutes, or "1:05:09" with seconds. */
export const clock = (ms: number, seconds = false) => {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);

    return seconds ? `${h}:${pad(m)}:${pad(total % 60)}` : `${h}:${pad(m)}`;
};

/** Start to finish: the session as it was trained. */
export const sessionMs = (workout: WorkoutSelect) =>
    workout.startedAt && workout.completedAt
        ? dayjs(workout.completedAt).diff(workout.startedAt)
        : 0;

export interface SessionRow {
    id: string;
    name: string;
    duration: string;
    date: string;
}

export interface MonthGroup {
    key: string;
    title: string;
    rows: SessionRow[];
    /** Totals and averages; only for a filter, not for All. */
    summary: { count: number; time: [string, string]; kcal: [string, string] } | null;
}

export const useSessions = (filter: string, locale: string) => {
    const { data: workouts } = useWorkouts();

    const completed = useMemo(
        () =>
            (workouts ?? [])
                .filter((w) => w.status === 'completed' && !!w.completedAt)
                .sort((a, b) => dayjs(b.completedAt).diff(a.completedAt)),
        [workouts],
    );

    // The filters after All and Workouts: each workout name, most trained first.
    const names = useMemo(() => {
        const counts = new Map<string, number>();
        completed.forEach((w) => counts.set(w.name, (counts.get(w.name) ?? 0) + 1));

        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    }, [completed]);

    const sessions = useMemo(
        () =>
            filter === ALL || filter === WORKOUTS
                ? completed
                : completed.filter((w) => w.name === filter),
        [completed, filter],
    );
    const summarised = filter !== ALL;

    // ponytail: one Health read per session, only while a filter is on; store kcal on the workout if months get long.
    const { data: kcal } = useQuery({
        queryKey: ['session-kcal', sessions.map((w) => w.id)],
        queryFn: async () =>
            Object.fromEntries(
                await Promise.all(
                    sessions.map(
                        async (w) =>
                            [
                                w.id,
                                w.startedAt
                                    ? await readActiveCalories(w.startedAt, w.completedAt!)
                                    : null,
                            ] as const,
                    ),
                ),
            ),
        enabled: summarised && sessions.length > 0,
        staleTime: 5 * 60_000,
    });

    const groups = useMemo(() => {
        const byMonth = new Map<string, WorkoutSelect[]>();
        sessions.forEach((w) => {
            const key = dayjs(w.completedAt).format('YYYY-MM');
            byMonth.set(key, [...(byMonth.get(key) ?? []), w]);
        });

        return [...byMonth.entries()].map(([key, list]): MonthGroup => {
            const time = list.reduce((sum, w) => sum + sessionMs(w), 0);
            const calories = list
                .map((w) => kcal?.[w.id])
                .filter((value): value is number => value != null);
            const kcalTotal = calories.reduce((sum, value) => sum + value, 0);

            return {
                key,
                title: dayjs(`${key}-01`).locale(locale).format('MMMM YYYY'),
                rows: list.map((w) => ({
                    id: w.id,
                    name: w.name,
                    duration: clock(sessionMs(w)),
                    // This week by weekday, anything older by date.
                    date:
                        dayjs().diff(w.completedAt, 'day') < 7
                            ? dayjs(w.completedAt).locale(locale).format('dddd')
                            : dayjs(w.completedAt).format('M/D/YY'),
                })),
                summary: summarised
                    ? {
                          count: list.length,
                          time: [clock(time, true), clock(time / list.length, true)],
                          kcal: calories.length
                              ? [
                                    String(Math.round(kcalTotal)),
                                    String(Math.round(kcalTotal / calories.length)),
                                ]
                              : ['–', '–'],
                      }
                    : null,
            };
        });
    }, [kcal, locale, sessions, summarised]);

    return { names, groups, workouts: completed };
};

export type DayStatus = 'completed' | 'planned' | 'missed' | 'in_progress';

/** The day a session counts for: when it was done, else when it is planned. */
const dayOf = (w: WorkoutSelect) => (w.status === 'completed' ? w.completedAt : w.startAt);

/**
 * The plan a week at a time for the Sessions screen: the chosen day's sessions,
 * done and planned, and the figures for that day and its week from what was
 * actually trained.
 */
export const useSessionDay = (date: string, firstWeekday: number) => {
    const { data: workouts } = useWorkouts();

    return useMemo(() => {
        const list = (workouts ?? []).filter((w) => w.status !== 'cancelled' && !!dayOf(w));
        const day = dayjs(date);
        const offset = firstWeekday === 1 ? day.day() : (day.day() + 6) % 7;
        const weekStart = day.subtract(offset, 'day').startOf('day');
        const weekEnd = weekStart.add(7, 'day');
        const inWeek = list.filter(
            (w) => !dayjs(dayOf(w)).isBefore(weekStart) && dayjs(dayOf(w)).isBefore(weekEnd),
        );
        const done = inWeek.filter((w) => w.status === 'completed');
        const startOfToday = dayjs().startOf('day');
        const statusOf = (w: WorkoutSelect): DayStatus =>
            w.status === 'planned' && dayjs(w.startAt).isBefore(startOfToday)
                ? 'missed'
                : (w.status as DayStatus);
        const sessions = list
            .filter((w) => dayjs(dayOf(w)).isSame(day, 'day'))
            .sort((a, b) => dayjs(dayOf(a)).diff(dayOf(b)))
            .map((w) => ({ workout: w, status: statusOf(w) }));
        const dayTime = sessions
            .filter(({ status }) => status === 'completed')
            .reduce((sum, { workout }) => sum + sessionMs(workout), 0);

        return {
            sessions,
            weekDone: `${done.length}/${inWeek.length}`,
            weekTime: clock(done.reduce((sum, w) => sum + sessionMs(w), 0)),
            dayTime: clock(dayTime),
            running: list.find((w) => w.status === 'in_progress') ?? null,
            workouts: list,
            isLoading: !workouts,
        };
    }, [date, firstWeekday, workouts]);
};

/**
 * Moves a planned session to now so it can be trained today, whatever day it
 * was planned for. When it was planned for a day still ahead, what was planned
 * for today takes that day instead, so it is done later rather than missed.
 */
export const moveToToday = async (workout: WorkoutSelect, workouts: WorkoutSelect[]) => {
    const now = dayjs();
    const from = workout.startAt;
    if (from && dayjs(from).isSame(now, 'day')) return;

    if (from && dayjs(from).isAfter(now, 'day')) {
        const todays = workouts.filter(
            (w) =>
                w.id !== workout.id &&
                w.status === 'planned' &&
                dayjs(w.startAt).isSame(now, 'day'),
        );
        await Promise.all(todays.map((w) => updateWorkout(w.id, { startAt: from })));
    }
    await updateWorkout(workout.id, { startAt: now.toDate() });
};
