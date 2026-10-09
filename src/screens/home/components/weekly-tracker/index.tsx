import { FC, useMemo } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon, type IconName } from '@/components/primitives/icon';
import { ProgressRing } from '@/components/layout/progress-ring';
import { useUser } from '@/hooks/use-user';
import { useAiProfile } from '@/hooks/use-ai';
import { derivePlanProgress, planWorkoutTypes } from '@/helpers/ai-plan';
import {
    buildWeekTracker,
    type TrackerDay,
    type TrackerDayStatus,
    type TrackerMetric,
} from '@/helpers/week-tracker';
import type { AiPlanSelect, WorkoutSelect } from '@/db/schema';

/**
 * The first thing on Home: this week, day by day, and the three figures that
 * say how it is going — workout sessions, rest days, active rest days.
 *
 * Everything here is `buildWeekTracker` over rows Home already holds, so when a
 * plan is applied or a session finished, the week redraws with the workouts
 * query; there is nothing of its own to refresh.
 *
 * The three hues are one per measure and were checked as a set for colour-blind
 * separation in light and dark (coral, blue, green — amber sat too close to the
 * coral). They are never the only cue: every ring is labelled in text, every day
 * carries an icon, and a legend sits under the strip.
 */

export const TRACKER_COLORS = {
    workout: '#ff453a',
    rest: '#3b82f6',
    activeRest: '#1f9d63',
} as const;

type Tone = keyof typeof TRACKER_COLORS;

const DAY_LOOK: Record<
    TrackerDayStatus,
    { tone: Tone | null; filled: boolean; icon: IconName | null }
> = {
    trained: { tone: 'workout', filled: true, icon: 'check' },
    active_rest: { tone: 'activeRest', filled: true, icon: 'walk' },
    rested: { tone: 'rest', filled: true, icon: 'moon' },
    missed: { tone: null, filled: false, icon: 'x' },
    planned_workout: { tone: 'workout', filled: false, icon: 'dumbbell' },
    planned_active_rest: { tone: 'activeRest', filled: false, icon: 'walk' },
    planned_rest: { tone: 'rest', filled: false, icon: 'moon' },
    open: { tone: null, filled: false, icon: null },
};

const DAY_SIZE = 36;

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderCurve: 'continuous',
        padding: theme.space(5),
        gap: theme.space(4),
        ...Platform.select({
            ios: {},
            default: { borderWidth: 1, borderColor: theme.colors.border },
        }),
    },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    titleBlock: {
        flex: 1,
        gap: theme.space(0.5),
    },
    eyebrow: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    title: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    plan: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    streak: {
        alignItems: 'center',
        gap: theme.space(1),
        paddingVertical: theme.space(1.5),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
    },
    streakText: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    rings: {
        justifyContent: 'space-around',
    },
    metric: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(2),
    },
    metricValue: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
    },
    metricTarget: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.mutedTypography,
    },
    metricLabel: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        textAlign: 'center',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    days: {
        justifyContent: 'space-between',
    },
    day: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    weekday: (isToday: boolean) => ({
        ...theme.fontSize.xs,
        fontWeight: isToday ? theme.fontWeight.bold.fontWeight : theme.fontWeight.medium.fontWeight,
        color: isToday ? theme.colors.typography : theme.colors.mutedTypography,
    }),
    dot: (color: string | null, filled: boolean) => ({
        height: DAY_SIZE,
        width: DAY_SIZE,
        borderRadius: theme.radius.full,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: filled && color ? color : 'transparent',
        borderWidth: filled ? 0 : 1.5,
        borderColor: color ?? theme.colors.border,
        borderStyle: color && !filled ? ('dashed' as const) : ('solid' as const),
    }),
    todayMarker: {
        height: theme.space(1),
        width: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.typography,
    },
    todayMarkerHidden: {
        backgroundColor: 'transparent',
    },
    legend: {
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: theme.space(4),
        rowGap: theme.space(1.5),
    },
    legendItem: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    legendSwatch: (color: string | null, filled: boolean) => ({
        height: theme.space(2.5),
        width: theme.space(2.5),
        borderRadius: theme.radius.full,
        backgroundColor: filled && color ? color : 'transparent',
        borderWidth: filled ? 0 : 1.5,
        borderColor: color ?? theme.colors.mutedTypography,
    }),
    legendText: {
        ...theme.fontSize['2xs'],
        color: theme.colors.mutedTypography,
    },
    hint: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
}));

interface WeeklyTrackerProps {
    workouts: WorkoutSelect[];
    /** Every applied plan, newest first — for which sessions are active rest. */
    plans: AiPlanSelect[];
    /** The plan running now, whose free days are this week's planned rest. */
    currentPlan: AiPlanSelect | null;
    streak: number;
}

const Metric: FC<{ metric: TrackerMetric; color: string; label: string; a11y: string }> = ({
    metric,
    color,
    label,
    a11y,
}) => {
    const { t } = useTranslation(['screens']);
    // No target means nothing was asked of this week; a ring with something in
    // it is then simply full.
    const progress = metric.target > 0 ? metric.done / metric.target : metric.done > 0 ? 1 : 0;

    return (
        <VStack style={styles.metric}>
            <ProgressRing progress={progress} color={color} accessibilityLabel={a11y}>
                <Text style={styles.metricValue}>{metric.done}</Text>
                {metric.target > 0 ? (
                    <Text style={styles.metricTarget}>
                        {t('home.tracker.of', { ns: 'screens', target: metric.target })}
                    </Text>
                ) : null}
            </ProgressRing>
            <Text style={styles.metricLabel} numberOfLines={2}>
                {label}
            </Text>
        </VStack>
    );
};

const Day: FC<{ day: TrackerDay }> = ({ day }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const look = DAY_LOOK[day.status];
    const color = look.tone ? TRACKER_COLORS[look.tone] : null;
    const iconColor = look.filled
        ? theme.solid.primaryTypography
        : (color ?? theme.solid.mutedTypography);
    const weekday = dayjs(day.date).format('dd');
    const label = `${dayjs(day.date).format('dddd D MMM')}: ${t(
        `home.tracker.status.${day.status}`,
        {
            ns: 'screens',
        },
    )}`;

    const content = (
        <VStack style={styles.day}>
            <Text style={styles.weekday(day.isToday)}>{weekday}</Text>
            <Box style={styles.dot(color, look.filled)}>
                {look.icon ? <Icon name={look.icon} size={16} color={iconColor} /> : null}
            </Box>
            <Box style={[styles.todayMarker, !day.isToday && styles.todayMarkerHidden]} />
        </VStack>
    );

    // A day with a workout on it opens that workout: the strip doubles as the
    // week's schedule now that there is no separate Workout tab.
    if (!day.workoutId) {
        return (
            <Box accessible accessibilityLabel={label}>
                {content}
            </Box>
        );
    }

    return (
        <Pressable
            onPress={() => router.navigate(`/workout/${day.workoutId}`)}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            {content}
        </Pressable>
    );
};

export const WeeklyTracker: FC<WeeklyTrackerProps> = ({ workouts, plans, currentPlan, streak }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const { profile } = useAiProfile();

    const firstWeekday = user?.firstWeekday === 1 ? 1 : 2;

    const tracker = useMemo(
        () =>
            buildWeekTracker({
                workouts,
                workoutTypes: planWorkoutTypes(plans),
                activePlan: currentPlan,
                sessionsPerWeek: profile?.sessionsPerWeek ?? null,
                firstWeekday,
            }),
        [currentPlan, firstWeekday, plans, profile?.sessionsPerWeek, workouts],
    );

    const planProgress = useMemo(
        () =>
            currentPlan && tracker.followsPlan ? derivePlanProgress(currentPlan, workouts) : null,
        [currentPlan, tracker.followsPlan, workouts],
    );

    const first = tracker.days[0].date;
    const last = tracker.days[tracker.days.length - 1].date;
    const range =
        first.getMonth() === last.getMonth()
            ? `${dayjs(first).format('D')}–${dayjs(last).format('D MMM')}`
            : `${dayjs(first).format('D MMM')} – ${dayjs(last).format('D MMM')}`;

    const metrics = [
        {
            key: 'workouts',
            metric: tracker.workouts,
            color: TRACKER_COLORS.workout,
            label: t('home.tracker.metrics.workouts', { ns: 'screens' }),
        },
        {
            key: 'rest',
            metric: tracker.rest,
            color: TRACKER_COLORS.rest,
            label: t('home.tracker.metrics.rest', { ns: 'screens' }),
        },
        {
            key: 'activeRest',
            metric: tracker.activeRest,
            color: TRACKER_COLORS.activeRest,
            label: t('home.tracker.metrics.activeRest', { ns: 'screens' }),
        },
    ];

    const legend: { key: string; color: string | null; filled: boolean }[] = [
        { key: 'workout', color: TRACKER_COLORS.workout, filled: true },
        { key: 'rest', color: TRACKER_COLORS.rest, filled: true },
        { key: 'activeRest', color: TRACKER_COLORS.activeRest, filled: true },
        { key: 'planned', color: null, filled: false },
    ];

    return (
        <VStack style={styles.container}>
            <HStack style={styles.header}>
                <VStack style={styles.titleBlock}>
                    <Text style={styles.eyebrow}>
                        {t('home.tracker.eyebrow', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.title}>{range}</Text>
                    {planProgress ? (
                        <Text style={styles.plan} numberOfLines={1}>
                            {t('home.tracker.following', {
                                ns: 'screens',
                                title: planProgress.title,
                                week: planProgress.week,
                                weeks: planProgress.weeks,
                            })}
                        </Text>
                    ) : null}
                </VStack>

                {streak > 0 ? (
                    <HStack style={styles.streak}>
                        <Icon name="flame" size={theme.space(3.5)} color={theme.colors.primary} />
                        <Text style={styles.streakText}>
                            {t('home.streak', { ns: 'screens', count: streak })}
                        </Text>
                    </HStack>
                ) : null}
            </HStack>

            <HStack style={styles.rings}>
                {metrics.map((entry) => (
                    <Metric
                        key={entry.key}
                        metric={entry.metric}
                        color={entry.color}
                        label={entry.label}
                        a11y={t('home.tracker.a11y', {
                            ns: 'screens',
                            label: entry.label,
                            done: entry.metric.done,
                            target: entry.metric.target,
                        })}
                    />
                ))}
            </HStack>

            <Box style={styles.divider} />

            <HStack style={styles.days}>
                {tracker.days.map((day) => (
                    <Day key={day.date.getTime()} day={day} />
                ))}
            </HStack>

            <HStack style={styles.legend}>
                {legend.map((entry) => (
                    <HStack key={entry.key} style={styles.legendItem}>
                        <Box style={styles.legendSwatch(entry.color, entry.filled)} />
                        <Text style={styles.legendText}>
                            {t(`home.tracker.legend.${entry.key}`, { ns: 'screens' })}
                        </Text>
                    </HStack>
                ))}
            </HStack>

            {tracker.followsPlan ? null : (
                <Text style={styles.hint}>{t('home.tracker.noPlanHint', { ns: 'screens' })}</Text>
            )}
        </VStack>
    );
};
