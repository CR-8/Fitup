import { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { useWorkoutWithDetails } from '@/hooks/use-workouts';
import { formatClockSecondsCompact } from './times';

export interface WorkoutGroup {
    id: string;
    title: string;
    workouts: WorkoutSelect[];
}

export const groupWorkoutsByWeek = (
    workouts: WorkoutSelect[],
    locale: string = 'en',
    firstWeekday: number = 2,
): WorkoutGroup[] => {
    const groups: WorkoutGroup[] = [];
    const weekMap = new Map<string, WorkoutSelect[]>();

    workouts
        .filter((workout) => workout.status === 'completed' && workout.completedAt)
        .forEach((workout) => {
            const completedDate = new Date(workout.completedAt!);
            const weekStart = getWeekStart(completedDate, firstWeekday);
            const weekKey = weekStart.toISOString().split('T')[0];

            if (!weekMap.has(weekKey)) {
                weekMap.set(weekKey, []);
            }
            weekMap.get(weekKey)!.push(workout);
        });

    const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => b.localeCompare(a));

    sortedWeeks.forEach(([weekKey, weekWorkouts]) => {
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const title = formatWeekRange(weekStart, weekEnd, locale);
        groups.push({
            id: weekKey,
            title,
            workouts: weekWorkouts.sort(
                (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
            ),
        });
    });

    return groups;
};

export const getPlannedWorkouts = (workouts: WorkoutSelect[]): WorkoutSelect[] => {
    return workouts
        .filter((workout) => workout.status === 'planned')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
 * Exported because the home screen's week strip had its own dayjs copy of this
 * arithmetic, and two implementations of "when does the week start" drift into
 * a strip that highlights different days than the list groups by.
 *
 * The time of day is deliberately carried over rather than zeroed.
 * `groupWorkoutsByWeek` keys on `toISOString().split('T')[0]`, which converts to
 * UTC first — so normalising to local midnight would move the key back a day for
 * every timezone ahead of UTC. Use `startOfWeekMs` where a real boundary is
 * wanted.
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

const formatWeekRange = (start: Date, end: Date, locale: string): string => {
    const startMonth = start.toLocaleDateString(locale, { month: 'long' });
    const endMonth = end.toLocaleDateString(locale, { month: 'long' });
    const startDay = start.getDate();
    const endDay = end.getDate();

    if (startMonth === endMonth) {
        return `${startDay} — ${endDay} ${startMonth}`;
    } else {
        return `${startDay} ${startMonth} — ${endDay} ${endMonth}`;
    }
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
