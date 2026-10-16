import { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { useWorkoutWithDetails } from '@/hooks/use-workouts';
import i18n from '@/locale/i18n';
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

const startOfDayMs = (now: Date): number => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);

    return d.getTime();
};

/**
 * Planned workouts still ahead of us: scheduled today or later, or not scheduled
 * at all. Soonest first, unscheduled last, `createdAt` as the tiebreaker.
 *
 * Anything scheduled before today is "missed", not planned — see
 * `getMissedWorkouts`. Keeping them out of this list is what stops Home offering
 * last week's session as today's.
 */
export const getPlannedWorkouts = (
    workouts: WorkoutSelect[],
    now: Date = new Date(),
): WorkoutSelect[] => {
    const today = startOfDayMs(now);

    return workouts
        .filter(
            (workout) =>
                workout.status === 'planned' &&
                (!workout.startAt || new Date(workout.startAt).getTime() >= today),
        )
        .sort((a, b) => {
            const aStart = a.startAt ? new Date(a.startAt).getTime() : Infinity;
            const bStart = b.startAt ? new Date(b.startAt).getTime() : Infinity;
            if (aStart !== bStart) return aStart < bStart ? -1 : 1;

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
};

/** Planned workouts whose day has passed without being started. Newest first. */
export const getMissedWorkouts = (
    workouts: WorkoutSelect[],
    now: Date = new Date(),
): WorkoutSelect[] => {
    const today = startOfDayMs(now);

    return workouts
        .filter(
            (workout) =>
                workout.status === 'planned' &&
                !!workout.startAt &&
                new Date(workout.startAt).getTime() < today,
        )
        .sort((a, b) => new Date(b.startAt!).getTime() - new Date(a.startAt!).getTime());
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

/**
 * Consecutive weeks, ending with the current one, in which at least
 * `targetPerWeek` workouts were completed.
 *
 * A weekly bar rather than a daily chain, so a rest day costs nothing. The
 * current week counts once it is met and is otherwise skipped, not fatal: a
 * streak should not read as broken on Wednesday of a week still in progress.
 */
export const computeWeeklyStreak = (
    workouts: WorkoutSelect[],
    targetPerWeek: number,
    now: Date = new Date(),
    firstWeekday: number = 2,
): number => {
    const target = Math.max(1, targetPerWeek);
    const perWeek = new Map<number, number>();

    for (const workout of workouts) {
        if (workout.status !== 'completed' || !workout.completedAt) continue;

        const week = startOfWeekMs(firstWeekday, new Date(workout.completedAt));
        perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
    }

    const cursor = new Date(startOfWeekMs(firstWeekday, now));
    const met = () => (perWeek.get(cursor.getTime()) ?? 0) >= target;

    let streak = 0;
    if (met()) streak += 1;
    cursor.setDate(cursor.getDate() - 7);

    while (met()) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 7);
    }

    return streak;
};

/** Sessions completed in the current week, for `formatWeekProgress`. */
export const countThisWeek = (
    workouts: WorkoutSelect[],
    firstWeekday: number = 2,
    now: Date = new Date(),
): number => summariseWeek(workouts, firstWeekday, now).sessions;

/** "1 of 4 this week". The one wording Today and Progress both use. */
export const formatWeekProgress = (done: number, target: number): string =>
    i18n.t('home.weekProgress', { ns: 'screens', done, target });

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
