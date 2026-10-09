import type { ExerciseSelect, ExerciseSetSelect } from '@/db/schema';
import type { ExerciseHistoryItem } from '@/crud/exercise';

export interface ExerciseHistorySummary {
    lastPerformedAt: Date | null;
    lastSetCount: number;
    bestSet: ExerciseSetSelect | null;
}

/**
 * What decides "best" depends on what the exercise tracks, in the order the
 * tracking list gives it: a weighted lift is judged on load (reps only break a
 * tie), a bodyweight one on reps, a hold on time, a run on distance.
 */
const bestKey = (exercise: ExerciseSelect): 'weight' | 'reps' | 'time' | 'distance' | null => {
    const tracking = Array.isArray(exercise.tracking) ? exercise.tracking : [];

    for (const key of ['weight', 'reps', 'time', 'distance'] as const) {
        if (tracking.includes(key)) return key;
    }

    return null;
};

/**
 * The best set among `sets`, judged the way `bestKey` describes.
 *
 * Shared by the exercise screen's history and the Monthly Tracker's personal
 * records, so a PR and the "best set" on the exercise it links to can never
 * disagree. Warm-ups never count as a best: a warm-up at a heavier weight than
 * the working sets is rare, but a warm-up out-repping them is routine.
 */
export const pickBestSet = <T extends ExerciseSetSelect>(
    exercise: ExerciseSelect,
    sets: Iterable<T>,
): T | null => {
    const key = bestKey(exercise);
    if (!key) return null;

    let bestSet: T | null = null;

    for (const set of sets) {
        if (set.type === 'warmup') continue;

        const value = set[key];
        if (value == null) continue;

        const current = bestSet?.[key] ?? null;
        const better =
            current == null ||
            value > current ||
            // Same load: the set with more reps is the better one.
            (key === 'weight' && value === current && (set.reps ?? 0) > (bestSet?.reps ?? 0));

        if (better) bestSet = set;
    }

    return bestSet;
};

/**
 * The two cards at the top of an exercise's history: when it was last done, and
 * the best set on record.
 *
 * `history` arrives newest first with completed sets only — `getExerciseHistory`
 * does both.
 */
export const summariseExerciseHistory = (
    exercise: ExerciseSelect,
    history: ExerciseHistoryItem[],
): ExerciseHistorySummary | null => {
    if (history.length === 0) return null;

    const [latest] = history;

    return {
        lastPerformedAt: latest.workout.completedAt ? new Date(latest.workout.completedAt) : null,
        lastSetCount: latest.sets.length,
        bestSet: pickBestSet(
            exercise,
            history.flatMap((item) => item.sets),
        ),
    };
};
