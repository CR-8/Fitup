import { create } from 'zustand';
import dayjs, { type Dayjs } from 'dayjs';

import type { AiProfileSelect } from '@/db/schema';

/**
 * Build Your Plan, after Apple Fitness's: the week it trains on, how long each
 * day is, for how many weeks, and what kinds of training. Review lays those out
 * as sessions per day, which the person can change, and Create Plan hands Syn
 * the whole brief at once, so it generates instead of asking questions.
 */

export const ACTIVITIES = [
    'fullBody',
    'upper',
    'lower',
    'core',
    'functional',
    'hiit',
    'cardio',
    'running',
    'cycling',
    'crossTraining',
    'mobility',
    'yoga',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** What each activity means to Syn, in the brief. */
const BRIEF_NAMES: Record<Activity, string> = {
    fullBody: 'full-body strength',
    upper: 'upper-body strength',
    lower: 'lower-body strength',
    core: 'core',
    functional: 'functional strength',
    hiit: 'HIIT',
    cardio: 'mixed cardio',
    running: 'running',
    cycling: 'cycling',
    crossTraining: 'cross training',
    mobility: 'mobility and flexibility',
    yoga: 'yoga',
};

export const MINUTE_OPTIONS = [10, 20, 30, 45, 60, 90] as const;
export const WEEK_OPTIONS = [1, 2, 3, 4, 6, 8] as const;
export const SESSION_MINUTES = [5, 10, 20, 30, 45, 60] as const;

export type Goal = NonNullable<AiProfileSelect['goal']>;
export type Place = NonNullable<AiProfileSelect['trainingEnvironment']>;
export const GOALS: Goal[] = ['lose', 'gain', 'maintain', 'recomp'];
export const PLACES: Place[] = ['gym', 'home'];

export interface Session {
    activity: Activity;
    minutes: number;
}

/** Weekdays Monday first: 0 is Monday, 6 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const weekdayOf = (date: Dayjs): Weekday => ((date.day() + 6) % 7) as Weekday;

/** The weekday's date on or after `from`. */
export const nextOn = (weekday: Weekday, from: Dayjs): Dayjs =>
    from.add((weekday - weekdayOf(from) + 7) % 7, 'day');

/**
 * A training day's minutes as sessions of about half an hour, the chosen
 * activities taken in turn across the week so every day gets a mix.
 */
export const splitWeek = (
    days: Weekday[],
    minutes: number,
    activities: Activity[],
): Partial<Record<Weekday, Session[]>> => {
    if (activities.length === 0) return {};
    const perDay = Math.min(Math.max(Math.round(minutes / 30), 1), 4);
    const each = Math.max(5, Math.round(minutes / perDay / 5) * 5);
    let next = 0;

    return Object.fromEntries(
        days.map((day) => [
            day,
            Array.from({ length: perDay }, () => ({
                activity: activities[next++ % activities.length],
                minutes: each,
            })),
        ]),
    );
};

export interface Brief {
    start: Dayjs;
    weeks: number;
    schedule: Partial<Record<Weekday, Session[]>>;
    goal: Goal | null;
    place: Place | null;
    /** Empty: none, said plainly. */
    conditions: string[];
    today?: Dayjs;
}

/**
 * The brief as Syn reads it: each training day of the first week by dayOffset
 * (counted from today, the way the plan is applied) with its sessions, plus
 * everything the intake would otherwise ask. Returns the intent and the
 * horizon that fits the first week.
 */
export const buildBrief = ({ start, weeks, schedule, goal, place, conditions, today }: Brief) => {
    const origin = (today ?? dayjs()).startOf('day');
    const days = WEEKDAYS.filter((day) => (schedule[day]?.length ?? 0) > 0)
        .map((day) => ({ day, date: nextOn(day, start.startOf('day')) }))
        .sort((a, b) => a.date.diff(b.date));

    const lines = days.map(({ day, date }) => {
        const sessions = schedule[day]!.map((s) => `${BRIEF_NAMES[s.activity]} ${s.minutes} min`);
        return `- dayOffset ${date.diff(origin, 'day')} (${date.format('dddd')}): ${sessions.join(', ')}`;
    });
    const last = days.length ? days[days.length - 1].date.diff(origin, 'day') : 6;

    const intent = [
        `One week of training, starting ${start.format('dddd, MMMM D')}, which I will repeat for ${weeks} week${weeks === 1 ? '' : 's'}.`,
        'Make exactly one workout on each of these days, at exactly these dayOffset values, covering the listed sessions in that order within the time given:',
        ...lines,
        'No workouts on any other day.',
        `Goal: ${goal ?? 'general fitness'}.`,
        `Where I train: ${place === 'home' ? 'at home, bodyweight only' : 'a gym with full equipment'}.`,
        `Injuries or conditions: ${conditions.length ? conditions.join('; ') : 'none'}.`,
        'This is everything you need. Do not ask questions; write the plan.',
    ].join('\n');

    return { intent, horizonDays: last + 1 };
};

interface BuildState {
    days: Weekday[];
    minutes: number;
    weeks: number;
    activities: Activity[];
    /** Set by Review from the choices above, then edited there. */
    schedule: Partial<Record<Weekday, Session[]>>;
    start: string | null;
    set: (updates: Partial<Omit<BuildState, 'set' | 'reset'>>) => void;
    reset: () => void;
}

const INITIAL = {
    days: [weekdayOf(dayjs())],
    minutes: 30,
    weeks: 4,
    activities: [] as Activity[],
    schedule: {},
    start: null,
};

/** The form's answers while it is open, shared by Build and Review. */
export const useBuildPlanStore = create<BuildState>()((set) => ({
    ...INITIAL,
    set: (updates) => set(updates),
    reset: () => set({ ...INITIAL, days: [weekdayOf(dayjs())] }),
}));
