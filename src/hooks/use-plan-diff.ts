import { useMemo } from 'react';

import { createdWorkoutIds } from '@/ai/apply-plan';
import type { AiPlanSelect } from '@/db/schema';
import { diffPlanAgainstSchedule, summarisePlanDiff } from '@/helpers/plan-diff';

import { useAppliedPlans } from './use-ai';
import { useWorkouts } from './use-workouts';

/**
 * What applying `plan` would do to the schedule right now. Only sessions an
 * earlier Syn plan created may be proposed for removal; a workout the user built
 * by hand is never taken off the schedule by omission.
 */
export const usePlanDiff = (plan: AiPlanSelect | null) => {
    const { data: workouts } = useWorkouts();
    const { plans } = useAppliedPlans();

    return useMemo(() => {
        if (!plan) return { rows: [], summary: summarisePlanDiff([]) };

        const removableIds = new Set(plans.flatMap((p) => createdWorkoutIds(p.appliedWorkoutIds)));
        const rows = diffPlanAgainstSchedule(
            plan.payload,
            (workouts ?? []).filter((workout) => workout.status === 'planned'),
            new Date(),
            { removableIds },
        );

        return { rows, summary: summarisePlanDiff(rows) };
    }, [plan, plans, workouts]);
};
