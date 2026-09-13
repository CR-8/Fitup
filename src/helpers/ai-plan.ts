import type { AiPlanSelect, WorkoutSelect } from '@/db/schema';
import type { AiPlanPayload } from '@/types/ai';

/**
 * What the active-plan card shows, derived from the plan row.
 *
 * Pure and separated from the component because every field here is arithmetic
 * over dates and array lengths, and all of it has an awkward edge: a plan
 * applied today is in week 1 and not week 0; a plan whose horizon has run out
 * should not report week 9 of 8; a plan with no workouts must not divide by
 * zero. Those are cheap to assert and invisible to check by hand, since the
 * wrong answer is still a plausible-looking number.
 */
export interface PlanProgress {
    title: string;
    /** 1-based, clamped into the plan's own length. */
    week: number;
    weeks: number;
    sessionsDone: number;
    sessionsTotal: number;
    /** Sessions a week, as the plan actually distributes them. */
    perWeek: number;
    /** True once the last week has passed, so the card can offer a new plan. */
    finished: boolean;
    /** Done with: every session completed, or its time is up. */
    complete: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Completed sessions, counted from rows the caller already holds.
 *
 * Home loads every workout for its week strip and its up-next card, so a
 * separate count query would be a second read of data already in memory — and
 * one that would not be invalidated when a session was finished, leaving the
 * card a step behind the strip directly above it.
 *
 * Ids the user has since deleted simply stop counting, which is why this
 * intersects live rows rather than trusting the stored array's length.
 */
const countCompleted = (workouts: WorkoutSelect[], appliedIds: string[] | null): number => {
    if (!appliedIds || appliedIds.length === 0) return 0;

    const applied = new Set(appliedIds);

    return workouts.reduce(
        (total, row) => (applied.has(row.id) && row.status === 'completed' ? total + 1 : total),
        0,
    );
};

export const derivePlanProgress = (
    plan: AiPlanSelect,
    workouts: WorkoutSelect[],
    now: number = Date.now(),
): PlanProgress => {
    const sessionsDone = countCompleted(workouts, plan.appliedWorkoutIds ?? null);
    const payload = plan.payload as AiPlanPayload;

    // `horizonDays` is what the model was asked for, so it is the plan's length
    // even when the workouts inside it do not reach the final day.
    const horizonDays = payload.horizonDays ?? 7;
    const weeks = Math.max(1, Math.ceil(horizonDays / 7));
    const sessionsTotal = payload.workouts?.length ?? 0;

    // Applied, not created: the plan starts when the user accepted it, which is
    // when `applyPlanToSchedule` wrote its workouts onto the calendar.
    const startedAt = plan.appliedAt ? new Date(plan.appliedAt).getTime() : null;
    const elapsedDays = startedAt === null ? 0 : Math.max(0, (now - startedAt) / DAY_MS);

    // Clamped at both ends. Day one is week one, and a plan left running past
    // its horizon stays on its last week rather than counting upward forever.
    const week = Math.min(weeks, Math.floor(elapsedDays / 7) + 1);

    // The plan's own length, not rounded up to a whole week: a 3-day food plan is
    // over after three days, and Home should offer the next one then.
    const finished = elapsedDays >= horizonDays;

    return {
        title: payload.title,
        week,
        weeks,
        sessionsDone: Math.min(sessionsDone, sessionsTotal),
        sessionsTotal,
        perWeek: sessionsTotal === 0 ? 0 : Math.round(sessionsTotal / weeks),
        finished,
        complete: finished || (sessionsTotal > 0 && sessionsDone >= sessionsTotal),
    };
};

/**
 * The plan to show as running, and how many are behind the user.
 *
 * `plans` is every applied plan, newest first. The newest is current until it is
 * complete; then Home offers a new one instead. An older plan is judged at the
 * moment the next one replaced it, so a plan abandoned in its first week does not
 * become "finished" just by being left alone until its horizon passes.
 */
export const summarisePlans = (
    plans: AiPlanSelect[],
    workouts: WorkoutSelect[],
    now: number = Date.now(),
): { current: AiPlanSelect | null; finished: number } => {
    let finished = 0;
    let current: AiPlanSelect | null = null;

    plans.forEach((plan, index) => {
        const replacedAt = index === 0 ? null : plans[index - 1].appliedAt;
        const at = replacedAt ? new Date(replacedAt).getTime() : now;
        const { complete } = derivePlanProgress(plan, workouts, at);

        if (complete) finished += 1;
        else if (index === 0) current = plan;
    });

    return { current, finished };
};
