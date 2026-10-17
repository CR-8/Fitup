import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { getEarnedAwards } from '@/crud/award';
import { toDateKey } from '@/crud/nutrition';
import { computeStreakDays } from '@/helpers/workouts';
import { useUser } from '@/hooks/use-user';
import { useWaterBetween, useWaterSettings } from '@/hooks/use-water';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { useWorkouts } from '@/hooks/use-workouts';
import {
    readAwardCatalogue,
    refreshAwardCatalogue,
    type AwardDefinition,
    type AwardGroup,
    type AwardMetric,
} from '@/services/award-catalogue';
import { useCalorieDays } from '@/screens/home/summary';

export type { AwardGroup, AwardShape, AwardSymbol } from '@/services/award-catalogue';

/**
 * Awards, after Apple Fitness's: each one a figure the app already keeps
 * (calories eaten, water drunk, sessions finished) against a target. Which
 * awards exist comes from the CMS catalogue (`services/award-catalogue`);
 * which are earned comes from `award_earned`, written by the award tracker
 * (`hooks/use-award-tracker`) the moment a figure meets its target.
 */

export type AwardUnit = 'kcal' | 'ml' | 'days' | 'workouts' | 'goals';

export interface Award extends AwardDefinition {
    value: number;
    /** The award's target, or the person's own goal when it has none. */
    goal: number;
    unit: AwardUnit;
    /** The stretch an earning counts for: `once`, a day, or a week's Monday. */
    period: string;
    /** 0–1, and 1 once earned for the period. */
    progress: number;
    /** Earned for the current period (or ever, for a one-off award). */
    earned: boolean;
    /** Meets its target now but not yet recorded: the tracker's to-do. */
    due: boolean;
    timesEarned: number;
    lastEarnedAt: Date | null;
}

export const AWARD_GROUPS: AwardGroup[] = ['daily', 'workouts'];

const UNITS: Record<AwardMetric, AwardUnit> = {
    calories_today: 'kcal',
    calorie_goal_days: 'goals',
    water_today: 'ml',
    water_goal_days: 'goals',
    workouts_total: 'workouts',
    workouts_week: 'workouts',
    streak_days: 'days',
};

const periodFor = (repeat: AwardDefinition['repeat'], today: string) => {
    if (repeat === 'daily') return today;
    if (repeat === 'weekly') {
        const day = dayjs(today);
        return toDateKey(day.subtract((day.day() + 6) % 7, 'day').toDate());
    }
    return 'once';
};

/** The CMS catalogue over the built-ins: the cached copy at once, refreshed hourly. */
export const useAwardCatalogue = () =>
    useQuery({
        queryKey: ['award-catalogue'],
        queryFn: refreshAwardCatalogue,
        initialData: readAwardCatalogue,
        // The cached copy is shown at once but still counts as stale, so it is refreshed on mount.
        initialDataUpdatedAt: 0,
        staleTime: 60 * 60_000,
    }).data;

export const useEarnedAwards = () => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['awards-earned', user?.id],
        queryFn: () => getEarnedAwards(user!.id),
        enabled: !!user?.id,
    });
};

export const useAwards = (today: string) => {
    const from = toDateKey(dayjs(today).subtract(1, 'year').toDate());
    const catalogue = useAwardCatalogue();
    const { data: earned } = useEarnedAwards();
    const { goalFor, consumedOn, isFetched: mealsFetched } = useCalorieDays(from, today);
    const { data: water } = useWaterBetween(from, today);
    const { targetMl } = useWaterSettings();
    const { data: workouts } = useWorkouts();
    const week = useWeeklyStreak();

    return useMemo(() => {
        const days = dayjs(today).diff(from, 'day') + 1;
        const dates = Array.from({ length: days }, (_, i) =>
            toDateKey(dayjs(from).add(i, 'day').toDate()),
        );

        const waterByDate: Record<string, number> = {};
        (water ?? []).forEach((log) => {
            waterByDate[log.date] = (waterByDate[log.date] ?? 0) + log.amountMl;
        });
        const list = workouts ?? [];

        const metrics: Record<AwardMetric, { value: number; goal?: number }> = {
            calories_today: { value: consumedOn(today), goal: goalFor(today) },
            calorie_goal_days: {
                value: dates.filter((d) => goalFor(d) > 0 && consumedOn(d) >= goalFor(d)).length,
            },
            water_today: { value: waterByDate[today] ?? 0, goal: targetMl },
            water_goal_days: {
                value: dates.filter((d) => (waterByDate[d] ?? 0) >= targetMl).length,
            },
            workouts_total: { value: list.filter((w) => w.status === 'completed').length },
            workouts_week: { value: week.done, goal: week.target },
            streak_days: { value: computeStreakDays(list) },
        };

        const all = catalogue.map((definition): Award => {
            const { value, goal: ownGoal } = metrics[definition.metric];
            const goal = definition.target ?? ownGoal ?? 0;
            const period = periodFor(definition.repeat, today);
            const records = (earned ?? []).filter((row) => row.awardId === definition.id);
            const recorded = records.some((row) => row.period === period);
            const meets = goal > 0 && value >= goal;

            return {
                ...definition,
                value: Math.round(value),
                goal,
                unit: UNITS[definition.metric],
                period,
                progress: recorded || meets ? 1 : goal > 0 ? Math.min(value / goal, 1) : 0,
                earned: recorded || meets,
                due: meets && !recorded,
                timesEarned: records.length,
                lastEarnedAt: records[0]?.createdAt ?? null,
            };
        });

        return {
            all,
            /** Not earned yet, closest first: what Apple calls Go For It. */
            goForIt: all.filter((a) => !a.earned).sort((a, b) => b.progress - a.progress),
            /** Every figure has loaded, so a missing award is really missing and not still loading. */
            isReady: !!workouts && !!water && !!earned && mealsFetched,
        };
    }, [
        catalogue,
        consumedOn,
        earned,
        from,
        goalFor,
        mealsFetched,
        targetMl,
        today,
        water,
        week,
        workouts,
    ]);
};

const fill = (text: string, award: Award) =>
    text
        .replace(/{{\s*value\s*}}/g, String(award.value))
        .replace(/{{\s*target\s*}}/g, String(award.goal));

/** An award's name, "3 of 10 workouts", and its description: the CMS's words when it has them. */
export const useAwardText = () => {
    const { t, i18n } = useTranslation(['screens']);
    const local = (words: Record<string, string> | undefined) =>
        words?.[i18n.language] ?? words?.en;

    return {
        name: (award: Award) =>
            local(award.name) ??
            t(`awards.items.${award.id}.name`, { ns: 'screens', defaultValue: award.id }),
        detail: (award: Award) =>
            t('awards.progress', {
                ns: 'screens',
                value: Math.min(award.value, award.goal),
                target: award.goal,
                unit: t(`awards.units.${award.unit}`, { ns: 'screens', count: award.goal }),
            }),
        description: (award: Award) => {
            const cms = local(award.description);
            return cms
                ? fill(cms, award)
                : t(`awards.items.${award.id}.description`, {
                      ns: 'screens',
                      value: award.value,
                      target: award.goal,
                      defaultValue: '',
                  });
        },
        earned: (award: Award) =>
            award.lastEarnedAt
                ? t('awards.earnedTimes', {
                      ns: 'screens',
                      count: award.timesEarned,
                      date: dayjs(award.lastEarnedAt).locale(i18n.language).format('MMM D, YYYY'),
                  })
                : null,
    };
};
