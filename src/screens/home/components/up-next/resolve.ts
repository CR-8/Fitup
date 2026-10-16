import { WorkoutSelect } from '@/db/schema';

/**
 * What the hero card at the top of Today should offer.
 *
 * Kept apart from the component so it can be reasoned about, and tested,
 * without a renderer. The component imports Unistyles, which reaches a native
 * module; this file imports nothing but a type.
 *
 * The states are a priority order, not a mode: a running workout outranks
 * today's planned one, which outranks "done for today", which outranks a rest
 * day, which outranks the invitation to create. Getting it wrong fails quietly:
 * you are offered the wrong workout, or asked to plan a new one while an old
 * one is still running.
 *
 * Every state except `create` carries the workout the card is about, so the
 * screens that list workouts under the card can leave it out of the list.
 */

export type UpNextState =
    | { kind: 'resume'; workout: WorkoutSelect }
    | { kind: 'start'; workout: WorkoutSelect }
    /** Something was finished today and nothing else is due. */
    | { kind: 'done'; workout: WorkoutSelect }
    /** Nothing is due today; `workout` is the next planned session. */
    | { kind: 'rest'; workout: WorkoutSelect }
    | { kind: 'create' };

const isDueToday = (workout: WorkoutSelect, now: Date): boolean => {
    // An unscheduled planned workout can be started whenever.
    if (!workout.startAt) return true;

    const start = new Date(workout.startAt);

    return (
        start.getFullYear() === now.getFullYear() &&
        start.getMonth() === now.getMonth() &&
        start.getDate() === now.getDate()
    );
};

export const resolveUpNext = (
    inProgressWorkouts: WorkoutSelect[],
    plannedWorkouts: WorkoutSelect[],
    completedToday: WorkoutSelect[] = [],
    now: Date = new Date(),
): UpNextState => {
    if (inProgressWorkouts.length > 0) return { kind: 'resume', workout: inProgressWorkouts[0] };

    const [next] = plannedWorkouts;
    if (next && isDueToday(next, now)) return { kind: 'start', workout: next };

    if (completedToday.length > 0) return { kind: 'done', workout: completedToday[0] };
    if (next) return { kind: 'rest', workout: next };

    return { kind: 'create' };
};
