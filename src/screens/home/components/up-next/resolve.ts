import { WorkoutSelect } from '@/db/schema';

/**
 * What the card at the top of Home should offer.
 *
 * Kept apart from the component so it can be reasoned about — and tested —
 * without a renderer. The component imports Unistyles, which reaches a native
 * module; this file imports nothing but a type.
 *
 * The three states are a priority order, not a mode: a running workout outranks
 * a planned one, and a planned one outranks the invitation to create. Getting it
 * wrong fails quietly — you are offered the wrong workout, or asked to plan a
 * new one while an old one is still running.
 */

export type UpNextState =
    | { kind: 'resume'; workout: WorkoutSelect }
    | { kind: 'start'; workout: WorkoutSelect }
    | { kind: 'create' };

export const resolveUpNext = (
    inProgressWorkouts: WorkoutSelect[],
    plannedWorkouts: WorkoutSelect[],
): UpNextState => {
    if (inProgressWorkouts.length > 0) return { kind: 'resume', workout: inProgressWorkouts[0] };
    if (plannedWorkouts.length > 0) return { kind: 'start', workout: plannedWorkouts[0] };

    return { kind: 'create' };
};
