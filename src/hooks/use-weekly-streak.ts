import { useMemo } from 'react';

import { computeWeeklyStreak, countThisWeek } from '@/helpers/workouts';
import { useAiProfile } from '@/hooks/use-ai';
import { useUser } from '@/hooks/use-user';
import { useWorkouts } from '@/hooks/use-workouts';

const DEFAULT_TARGET = 3;

/**
 * The one source for "how am I doing this week", so Today and Progress cannot
 * disagree: the weekly target is the AI profile's `sessionsPerWeek` (3 when
 * unset), the streak is consecutive weeks that met it.
 */
export const useWeeklyStreak = () => {
    const { data: workouts } = useWorkouts();
    const { profile } = useAiProfile();
    const { user } = useUser();
    const firstWeekday = user?.firstWeekday || 2;
    const target = profile?.sessionsPerWeek || DEFAULT_TARGET;

    return useMemo(() => {
        const list = workouts ?? [];

        return {
            target,
            done: countThisWeek(list, firstWeekday),
            streak: computeWeeklyStreak(list, target, new Date(), firstWeekday),
        };
    }, [firstWeekday, target, workouts]);
};
