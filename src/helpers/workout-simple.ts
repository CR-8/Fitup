import { ExerciseSetSelect } from '@/db/schema';
import { OrderedExercise } from './workouts';
import { isRestActive, isRestFinalized } from '@/helpers/rest';
import { ExecutionOrderSet } from '@/helpers/execution-order';

/**
 * Ultra-simple workout logic - just 3 functions based on DB fields
 */

export type WorkoutState = 'performing' | 'resting' | 'resting_no_next' | 'ready' | 'completed';

export interface WorkoutInfo {
    state: WorkoutState;
    exerciseId?: string;
    currentSet?: ExerciseSetSelect;
    nextSet?: ExerciseSetSelect;
    activeRestSet?: ExerciseSetSelect;
}

/**
 * Get current workout state - just look at DB fields.
 *
 * When executionOrderSets is provided, next-set resolution follows
 * execution order (round-robin for supersets). Without it, falls back
 * to linear exercise-by-exercise ordering.
 */
export const getWorkoutState = (
    exercises: OrderedExercise[],
    executionOrderSets?: ExecutionOrderSet[],
    scopeExerciseId?: string,
): WorkoutInfo => {
    const now = Date.now();

    // Build flat execution list for next-set lookups
    const allSets: ExecutionOrderSet[] = executionOrderSets
        ? executionOrderSets
        : exercises.flatMap((ex) => ex.sets.map((set) => ({ set, exerciseId: ex.id })));

    /**
     * When a specific exercise is being viewed, resolve state within it.
     *
     * Without this the primary action is global: standing on the third exercise
     * and pressing it would act on whichever set the workout pointer happened to
     * be on — normally the first exercise's first set. The button is rendered on
     * one exercise's screen, so it has to act on that exercise.
     *
     * Advancing between exercises still happens automatically after a set is
     * completed; this only governs what the visible control does.
     */
    const flatSets = scopeExerciseId
        ? allSets.filter((entry) => entry.exerciseId === scopeExerciseId)
        : allSets;

    // 1. Find active rest first. In a desynced state this is safer than
    // letting a stray started set jump ahead while another set is still resting.
    const activeRestEntry = flatSets.find(({ set }) => {
        if (!set.completedAt || !set.restTime || set.restTime <= 0 || isRestFinalized(set)) {
            return false;
        }

        return isRestActive(set, now);
    });

    if (activeRestEntry) {
        const restIdx = flatSets.findIndex((eo) => eo.set.id === activeRestEntry.set.id);
        const nextEntry = flatSets
            .slice(restIdx === -1 ? 0 : restIdx + 1)
            .find((eo) => !eo.set.completedAt);

        // "No next set" has to mean the workout is finished, not merely that this
        // exercise is. Fall back to the full order so the rest of the session is
        // still counted when the view is scoped to one exercise.
        const globalNextEntry =
            nextEntry ??
            allSets
                .slice(allSets.findIndex((eo) => eo.set.id === activeRestEntry.set.id) + 1)
                .find((eo) => !eo.set.completedAt);

        return {
            state: globalNextEntry ? 'resting' : 'resting_no_next',
            exerciseId: activeRestEntry.exerciseId,
            activeRestSet: activeRestEntry.set,
            nextSet: nextEntry?.set ?? globalNextEntry?.set,
        };
    }

    // 2. Find performing set by execution order.
    const performingEntry = flatSets.find(({ set }) => set.startedAt && !set.completedAt);
    if (performingEntry) {
        return {
            state: 'performing',
            exerciseId: performingEntry.exerciseId,
            currentSet: performingEntry.set,
        };
    }

    // 3. Find next pending set using execution order.
    const nextPending = flatSets.find((eo) => !eo.set.startedAt && !eo.set.completedAt);
    if (nextPending) {
        return { state: 'ready', exerciseId: nextPending.exerciseId, nextSet: nextPending.set };
    }

    return { state: 'completed' };
};

/**
 * Check if any rest is active
 */
export const hasActiveRest = (exercises: OrderedExercise[]): boolean => {
    const now = Date.now();
    return exercises.some((ex) =>
        ex.sets.some(
            (set) =>
                set.completedAt &&
                set.restTime &&
                set.restTime > 0 &&
                !isRestFinalized(set) &&
                isRestActive(set, now),
        ),
    );
};

/**
 * Get button icon
 */
export const getButtonIcon = (
    info: WorkoutInfo,
    workoutExerciseId: string,
    workoutStatus?: string,
): 'play' | 'check' | 'stop' | 'collapse' | 'back' => {
    if (workoutStatus === 'planned') return 'play';
    if (workoutStatus === 'completed' || info.state === 'completed') return 'collapse';

    if (info.exerciseId && info.exerciseId !== workoutExerciseId) {
        if (workoutStatus === 'planned') return 'play';
        return 'back';
    }

    switch (info.state) {
        case 'performing':
            return 'check';
        case 'resting':
        case 'resting_no_next':
            return 'stop';
        case 'ready':
            return 'play';
        default:
            return 'collapse';
    }
};
