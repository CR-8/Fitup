import { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { useWorkoutWithDetails } from '@/hooks/use-workouts';
import { formatClockSecondsCompact } from './times';

/**
 * Planned workouts, the one to do next first.
 *
 * An applied AI plan creates a week of sessions at the same moment, so creation
 * order says nothing about which comes first; the schedule does. In order:
 *
 *   1. Scheduled today or later, soonest first — today's session leads.
 *   2. Unscheduled drafts, newest first, as before plans had dates.
 *   3. Scheduled on a day already gone (missed), most recent first — still
 *      startable, but never offered ahead of today's.
 */
export const getPlannedWorkouts = (
    workouts: WorkoutSelect[],
    now: Date = new Date(),
): WorkoutSelect[] => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const rank = (workout: WorkoutSelect): number => {
        if (!workout.startAt) return 1;
        return new Date(workout.startAt).getTime() >= todayMs ? 0 : 2;
    };

    return workouts
        .filter((workout) => workout.status === 'planned')
        .sort((a, b) => {
            const byRank = rank(a) - rank(b);
            if (byRank !== 0) return byRank;

            if (rank(a) === 0) {
                return new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime();
            }
            if (rank(a) === 2) {
                return new Date(b.startAt!).getTime() - new Date(a.startAt!).getTime();
            }

            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
};

export const getInProgressWorkouts = (workouts: WorkoutSelect[]): WorkoutSelect[] => {
    return workouts
        .filter((workout) => workout.status === 'in_progress')
        .sort((a, b) => {
            const aTime = (a.startedAt ?? a.createdAt) as Date;
            const bTime = (b.startedAt ?? b.createdAt) as Date;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
};

export type OrderedExercise = {
    id: string;
    createdAt: Date;
    groupId?: string | null;
    orderInGroup?: number | null;
    sets: ExerciseSetSelect[];
};

export const getOrderedExercisesFromDetails = (
    details: ReturnType<typeof useWorkoutWithDetails>['data'] | null | undefined,
) => {
    if (!details) return [];

    const groupOrderMap = new Map((details.groups || []).map((g) => [g.group.id, g.group.order]));

    const list = details.exercises.map((it) => ({
        id: it.workoutExercise.id,
        createdAt:
            it.workoutExercise.createdAt instanceof Date
                ? it.workoutExercise.createdAt
                : new Date(it.workoutExercise.createdAt),
        groupId: it.workoutExercise.groupId,
        orderInGroup: it.workoutExercise.orderInGroup,
        sets: it.sets.slice().sort((a, b) => a.order - b.order),
    }));

    return list.slice().sort((a, b) => {
        const groupOrderA = a.groupId ? (groupOrderMap.get(a.groupId) ?? 0) : 0;
        const groupOrderB = b.groupId ? (groupOrderMap.get(b.groupId) ?? 0) : 0;

        if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB;

        const orderInGroupA = a.orderInGroup ?? 0;
        const orderInGroupB = b.orderInGroup ?? 0;

        if (orderInGroupA !== orderInGroupB) return orderInGroupA - orderInGroupB;

        return a.createdAt.getTime() - b.createdAt.getTime();
    });
};

export const getFlattenedOrderedSetsFromDetails = (
    details: ReturnType<typeof useWorkoutWithDetails>['data'] | null | undefined,
): ExerciseSetSelect[] => {
    const ordered = getOrderedExercisesFromDetails(details);

    const flattened: ExerciseSetSelect[] = [];

    for (const ex of ordered) {
        for (const s of ex.sets) flattened.push(s);
    }

    return flattened;
};

/**
 * The first day of the week `date` falls in.
 *
 * Exported so every "this week" in the app — the Home weekly tracker, the
 * week summaries — agrees on where the week starts.
 *
 * The time of day is carried over rather than zeroed; use `startOfWeekMs`
 * where a real local-midnight boundary is wanted.
 */
export const getWeekStart = (date: Date, firstWeekday: number = 2): Date => {
    const d = new Date(date);
    const day = d.getDay();
    // firstWeekday: 1 = Sunday, 2 = Monday
    // Convert to 0-based day where 0 is the first day of week
    const adjustedDay = firstWeekday === 1 ? day : day === 0 ? 6 : day - 1;
    const diff = d.getDate() - adjustedDay;
    return new Date(d.setDate(diff));
};

/**
 * The instant the current week began, as a local-midnight timestamp.
 *
 * The boundary form of `getWeekStart`, for asking "since when" — a SQL range, or
 * a filter over completed workouts. Kept separate rather than folded into the
 * function above, whose callers depend on the time of day surviving.
 */
export const startOfWeekMs = (firstWeekday: number = 2, now: Date = new Date()): number => {
    const start = getWeekStart(now, firstWeekday);
    start.setHours(0, 0, 0, 0);

    return start.getTime();
};

export interface WeekSummary {
    /** Workouts completed since the week began. */
    sessions: number;
    /** Their total logged duration. Workouts with no duration count as zero. */
    durationSeconds: number;
}

/**
 * What has been done so far this week, from rows the home screen already holds.
 *
 * Deliberately not a query. `status`, `completedAt` and `duration` are all
 * columns on the workout row, and `useWorkouts` has loaded every one of them —
 * so counting them here costs nothing and cannot fall out of step with the list
 * rendered from the same array. Volume is the exception and needs SQL, because
 * it lives on the sets.
 */
export const summariseWeek = (
    workouts: WorkoutSelect[],
    firstWeekday: number = 2,
    now: Date = new Date(),
): WeekSummary => {
    const since = startOfWeekMs(firstWeekday, now);

    return workouts.reduce<WeekSummary>(
        (summary, workout) => {
            if (workout.status !== 'completed' || !workout.completedAt) return summary;
            if (new Date(workout.completedAt).getTime() < since) return summary;

            return {
                sessions: summary.sessions + 1,
                durationSeconds: summary.durationSeconds + (workout.duration ?? 0),
            };
        },
        { sessions: 0, durationSeconds: 0 },
    );
};

/**
 * Consecutive days, ending today, on which a workout was completed.
 *
 * Same bargain as `summariseWeek`: `status` and `completedAt` are columns the
 * screens have already loaded, so this is arithmetic over an array in hand
 * rather than another query.
 *
 * Today counts when it has a completed workout, and is skipped rather than
 * fatal when it does not — a run of five days should not read as broken at
 * breakfast on the sixth, before anyone has had the chance to train. Two days
 * without a workout ends it.
 */
export const computeStreakDays = (workouts: WorkoutSelect[], now: Date = new Date()): number => {
    const days = new Set<number>();

    for (const workout of workouts) {
        if (workout.status !== 'completed' || !workout.completedAt) continue;

        const day = new Date(workout.completedAt);
        day.setHours(0, 0, 0, 0);
        days.add(day.getTime());
    }

    if (days.size === 0) return 0;

    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);

    // Yesterday is the other valid anchor, so an untrained today is a grace day
    // rather than a reset.
    if (!days.has(cursor.getTime())) {
        cursor.setDate(cursor.getDate() - 1);
        if (!days.has(cursor.getTime())) return 0;
    }

    let streak = 0;

    while (days.has(cursor.getTime())) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
};

export const formatSet = (exercise: ExerciseSelect | undefined, set: ExerciseSetSelect) => {
    if (!exercise) return '';
    const parts: string[] = [];
    const tracking: ExerciseSelect['tracking'] = Array.isArray(exercise.tracking)
        ? exercise.tracking
        : [];
    for (const key of tracking) {
        if (key === 'weight' && set.weight != null) {
            const unit = exercise.weightUnits || '';
            parts.push(`${set.weight} ${unit}`.trim());
        }
        if (key === 'reps' && set.reps != null) {
            parts.push(`${set.reps}`);
        }
        if (key === 'time' && set.time != null) {
            parts.push(formatClockSecondsCompact(set.time));
        }
        if (key === 'distance' && set.distance != null) {
            const unit = exercise.distanceUnits || '';
            parts.push(`${set.distance} ${unit}`.trim());
        }
    }
    return parts.join(' x ');
};
