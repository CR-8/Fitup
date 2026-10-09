import type { AiPlanSelect, WorkoutSelect } from '@/db/schema';
import type { AiPlanPayload, AiPlanWorkoutType } from '@/types/ai';

import { startOfWeekMs } from './workouts';

/**
 * The Home weekly tracker: what each day of this week was (or is planned to
 * be), and the three figures the client asked for — workout sessions, rest days
 * and active rest days.
 *
 * Pure and derived from rows Home already holds, for the same reason as
 * `summariseWeek`: it then cannot fall out of step with the rest of the screen,
 * and applying an AI plan updates it the moment the workouts query refreshes.
 *
 * Where the numbers come from:
 *
 *   - A workout lands on the day it was completed, or — not yet done — the day
 *     it is scheduled for (`startAt`). Unscheduled drafts and cancelled
 *     workouts are on no day.
 *   - A workout is active rest when the AI plan that created it says so (see
 *     `planWorkoutTypes`), or, for one built by hand, when its name says it is
 *     recovery work ("Mobility", "Active recovery"…). Everything else is
 *     training.
 *   - A rest day is a day that passed with nothing done and no workout missed.
 *     Today counts as soon as the plan has made it a rest day — nobody should
 *     have to wait until midnight to see their rest day recorded.
 *   - Targets follow the running plan when there is one. Without a plan, the
 *     workout target is the profile's sessions per week (or what is scheduled,
 *     if more), and rest fills the rest of the week.
 */

export type TrackerDayStatus =
    /** A training session was completed. */
    | 'trained'
    /** Only active-rest work was completed. */
    | 'active_rest'
    /** The day passed (or is a planned rest day today) with nothing done. */
    | 'rested'
    /** A training session was scheduled and the day passed without it. */
    | 'missed'
    | 'planned_workout'
    | 'planned_active_rest'
    /** The running plan leaves this day free. */
    | 'planned_rest'
    /** Nothing done, nothing planned, not yet over. */
    | 'open';

export interface TrackerDay {
    date: Date;
    isToday: boolean;
    status: TrackerDayStatus;
    /** The workout a tap on the day should open, when there is one. */
    workoutId: string | null;
}

export interface TrackerMetric {
    done: number;
    target: number;
}

export interface WeekTracker {
    days: TrackerDay[];
    workouts: TrackerMetric;
    rest: TrackerMetric;
    activeRest: TrackerMetric;
    /** True when the running AI plan covers part of this week. */
    followsPlan: boolean;
}

export interface WeekTrackerInput {
    workouts: WorkoutSelect[];
    /** From `planWorkoutTypes`: what each plan-created workout is. */
    workoutTypes: Map<string, AiPlanWorkoutType>;
    /** The plan currently running, whose free days are planned rest. */
    activePlan: AiPlanSelect | null;
    sessionsPerWeek: number | null;
    /** 1 = Sunday, 2 = Monday, as stored on the user. */
    firstWeekday: number;
    now?: Date;
}

const DAYS_IN_WEEK = 7;

/** Hand-built sessions that are recovery work by name. English only, like the default names. */
const ACTIVE_REST_NAME = /\b(active[\s-]?(rest|recovery)|recovery|mobility|stretch(ing)?|yoga)\b/i;

const startOfDay = (date: Date): Date => {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const workoutDay = (workout: WorkoutSelect): Date | null => {
    if (workout.status === 'cancelled') return null;

    const at =
        workout.status === 'completed'
            ? workout.completedAt
            : workout.status === 'in_progress'
              ? (workout.startedAt ?? workout.startAt)
              : workout.startAt;

    return at ? startOfDay(new Date(at)) : null;
};

const workoutType = (
    workout: WorkoutSelect,
    types: Map<string, AiPlanWorkoutType>,
): AiPlanWorkoutType =>
    types.get(workout.id) ?? (ACTIVE_REST_NAME.test(workout.name) ? 'active_rest' : 'training');

/** The days a plan runs over: from the day it was applied, for its horizon. */
const planCoverage = (plan: AiPlanSelect | null): { start: number; end: number } | null => {
    if (!plan?.appliedAt) return null;

    const start = startOfDay(new Date(plan.appliedAt));
    const horizonDays = (plan.payload as AiPlanPayload).horizonDays ?? DAYS_IN_WEEK;

    return { start: start.getTime(), end: addDays(start, horizonDays).getTime() };
};

interface DayBucket {
    completedTraining: WorkoutSelect[];
    completedActiveRest: WorkoutSelect[];
    scheduledTraining: WorkoutSelect[];
    scheduledActiveRest: WorkoutSelect[];
}

export const buildWeekTracker = ({
    workouts,
    workoutTypes,
    activePlan,
    sessionsPerWeek,
    firstWeekday,
    now = new Date(),
}: WeekTrackerInput): WeekTracker => {
    const weekStart = new Date(startOfWeekMs(firstWeekday, now));
    const today = startOfDay(now).getTime();
    const dates = Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));
    const buckets = new Map<number, DayBucket>(
        dates.map((date) => [
            date.getTime(),
            {
                completedTraining: [],
                completedActiveRest: [],
                scheduledTraining: [],
                scheduledActiveRest: [],
            },
        ]),
    );

    for (const workout of workouts) {
        const day = workoutDay(workout);
        const bucket = day ? buckets.get(day.getTime()) : undefined;
        if (!bucket) continue;

        const isActiveRest = workoutType(workout, workoutTypes) === 'active_rest';

        if (workout.status === 'completed') {
            (isActiveRest ? bucket.completedActiveRest : bucket.completedTraining).push(workout);
        } else {
            (isActiveRest ? bucket.scheduledActiveRest : bucket.scheduledTraining).push(workout);
        }
    }

    const coverage = planCoverage(activePlan);
    const isCovered = (time: number) =>
        coverage !== null && time >= coverage.start && time < coverage.end;

    const days: TrackerDay[] = dates.map((date) => {
        const time = date.getTime();
        const bucket = buckets.get(time)!;
        const isToday = time === today;
        const isPast = time < today;

        const day = (status: TrackerDayStatus, workout?: WorkoutSelect): TrackerDay => ({
            date,
            isToday,
            status,
            workoutId: workout?.id ?? null,
        });

        if (bucket.completedTraining.length > 0) return day('trained', bucket.completedTraining[0]);
        if (bucket.completedActiveRest.length > 0) {
            return day('active_rest', bucket.completedActiveRest[0]);
        }

        if (isPast) {
            return bucket.scheduledTraining.length > 0
                ? day('missed', bucket.scheduledTraining[0])
                : day('rested');
        }

        if (bucket.scheduledTraining.length > 0) {
            return day('planned_workout', bucket.scheduledTraining[0]);
        }
        if (bucket.scheduledActiveRest.length > 0) {
            return day('planned_active_rest', bucket.scheduledActiveRest[0]);
        }
        if (isCovered(time)) return day(isToday ? 'rested' : 'planned_rest');

        return day('open');
    });

    const all = [...buckets.values()];
    const sessionsDone = all.reduce((total, bucket) => total + bucket.completedTraining.length, 0);
    const sessionsScheduled = all.reduce(
        (total, bucket) =>
            total + bucket.completedTraining.length + bucket.scheduledTraining.length,
        0,
    );
    const activeRestDays = all.filter(
        (bucket) => bucket.completedActiveRest.length + bucket.scheduledActiveRest.length > 0,
    ).length;

    const followsPlan = dates.some((date) => isCovered(date.getTime()));

    const workoutTarget = Math.max(
        sessionsDone,
        followsPlan ? sessionsScheduled : Math.max(sessionsScheduled, sessionsPerWeek ?? 0),
    );
    const activeRestDone = days.filter((day) => day.status === 'active_rest').length;
    const activeRestTarget = Math.max(activeRestDays, activeRestDone);

    return {
        days,
        workouts: { done: sessionsDone, target: workoutTarget },
        activeRest: { done: activeRestDone, target: activeRestTarget },
        rest: {
            done: days.filter((day) => day.status === 'rested').length,
            target: Math.max(0, DAYS_IN_WEEK - workoutTarget - activeRestTarget),
        },
        followsPlan,
    };
};
