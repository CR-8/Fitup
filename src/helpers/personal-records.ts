import type { ExerciseSelect, ExerciseSetSelect } from '@/db/schema';

import { pickBestSet } from './exercise-history';

/**
 * One line of the Monthly Tracker's personal records: the best set ever logged
 * for an exercise, and when it was set.
 *
 * "Best" is `pickBestSet`'s rule — the same one the exercise screen uses for
 * its best-set card — so tapping through from a record never shows a different
 * number.
 */
export interface PersonalRecord {
    exercise: ExerciseSelect;
    set: ExerciseSetSelect;
    /** When the workout holding the record set was completed. */
    achievedAt: Date;
}

/** A completed set, the exercise it belongs to, and when its workout finished. */
export interface PersonalRecordRow {
    exercise: ExerciseSelect;
    set: ExerciseSetSelect;
    workoutCompletedAt: Date;
}

/**
 * Every exercise's record, newest record first.
 *
 * Ordered by when the record was set rather than by name, because the list
 * lives on a monthly screen: what was beaten recently is the news, and the
 * lifts that have not moved in a while sink to the bottom on their own.
 */
export const buildPersonalRecords = (rows: PersonalRecordRow[]): PersonalRecord[] => {
    const byExercise = new Map<string, PersonalRecordRow[]>();

    for (const row of rows) {
        const bucket = byExercise.get(row.exercise.id) ?? [];
        bucket.push(row);
        byExercise.set(row.exercise.id, bucket);
    }

    const records: PersonalRecord[] = [];

    for (const bucket of byExercise.values()) {
        // Oldest first, so on a tie the set that got there first keeps the
        // record — a record is "first to reach", not "most recent to equal".
        const ordered = [...bucket].sort(
            (a, b) => a.workoutCompletedAt.getTime() - b.workoutCompletedAt.getTime(),
        );
        const completedAtBySet = new Map(
            ordered.map((row) => [row.set.id, row.workoutCompletedAt]),
        );
        const best = pickBestSet(
            ordered[0].exercise,
            ordered.map((row) => row.set),
        );

        if (!best) continue;

        records.push({
            exercise: ordered[0].exercise,
            set: best,
            achievedAt: completedAtBySet.get(best.id)!,
        });
    }

    return records.sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());
};
