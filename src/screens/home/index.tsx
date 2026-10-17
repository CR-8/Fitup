import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import dayjs from 'dayjs';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { getInProgressWorkouts, getMissedWorkouts, getPlannedWorkouts } from '@/helpers/workouts';
import { getPlanWeekByWorkoutId } from '@/helpers/ai-plan';
import { useMissedSessionStore } from '@/stores/missed-session';
import { useAppliedPlans } from '@/hooks/use-ai';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { useTodayKey } from '@/hooks/use-water';
import { useCaloriesStore } from '@/stores/calories';

import { Greeting } from './components';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { Bars, Line, Metric, PeriodPicker, Ring } from './components/charts';
import { ACCENT, PERIODS, useSummary, type Period } from './summary';

/**
 * Today, laid out after Apple Fitness's Summary: a period picker over water,
 * distance, sessions and calories, then the workout to do now. The charts and
 * picker are native SwiftUI on iOS and drawn by the app on Android
 * (`components/charts`); the cards around them are shared.
 */

const RING_SIZE = 132;

/** The missed-session sheet is offered once per app open, not on every visit to Today. */
let missedPromptShown = false;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        ...Platform.select({
            // The scroll view insets itself from the status bar on iOS.
            ios: { paddingTop: theme.space(4) },
            // Android has no header here, so the screen clears the status bar itself.
            default: { paddingTop: rt.insets.top + theme.space(4) },
        }),
        paddingBottom: theme.screenContentPadding('root').paddingBottom,
        gap: theme.space(4),
    },
    /** Android: keeps scrolled cards from running under the clock and battery icons. */
    statusBarScrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: rt.insets.top,
        backgroundColor: theme.colors.background,
    },
    section: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    row: {
        gap: theme.space(3),
    },
    tile: {
        flex: 1,
        padding: theme.space(4),
        gap: theme.space(3),
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.elevated,
    },
    tileHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    tileTitle: {
        flex: 1,
        fontSize: 19,
        lineHeight: 24,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    chevron: {
        height: 26,
        width: 26,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.neutral[700],
    },
    caption: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    segments: {
        gap: theme.space(1.5),
    },
    segment: {
        gap: theme.space(1.5),
    },
    segmentBar: {
        height: 8,
        borderRadius: theme.radius.full,
    },
    segmentValue: (highlighted: boolean) => ({
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: highlighted ? theme.colors.typography : theme.colors.mutedTypography,
    }),
    target: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    targetTitle: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    stats: {
        gap: theme.space(3),
    },
    ring: {
        width: RING_SIZE,
        height: RING_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringLabel: {
        position: 'absolute',
        alignItems: 'center',
    },
    upNextPlaceholder: {
        marginHorizontal: theme.space(4),
        height: 196,
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.foreground,
    },
}));

const Tile: FC<{ title?: string; onPress?: () => void; children: ReactNode }> = ({
    title,
    onPress,
    children,
}) => {
    const { theme } = useUnistyles();

    return (
        <Pressable
            style={styles.tile}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
        >
            {title ? (
                <HStack style={styles.tileHeader}>
                    <Text style={styles.tileTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    {onPress ? (
                        <Box style={styles.chevron}>
                            <Icon
                                name="chevron-right"
                                size={12}
                                color={theme.colors.mutedTypography}
                            />
                        </Box>
                    ) : null}
                </HStack>
            ) : null}
            {children}
        </Pressable>
    );
};

const HomeScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const today = useTodayKey();
    const [period, setPeriod] = useState<Period>('today');
    const summary = useSummary(period, today);
    const setCaloriesDay = useCaloriesStore((state) => state.setDay);
    const openMetric = (kind: 'water' | 'distance' | 'sessions') =>
        router.navigate({ pathname: '/metric', params: { kind, period } } as never);

    const { data: workouts } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { plans } = useAppliedPlans();
    const { elapsedFormated } = useRunningWorkoutTicker();

    const upNext = useMemo(() => {
        const list = workouts ?? [];
        const completedToday = list.filter(
            (workout) =>
                workout.status === 'completed' &&
                !!workout.completedAt &&
                dayjs(workout.completedAt).isSame(dayjs(), 'day'),
        );

        return resolveUpNext(getInProgressWorkouts(list), getPlannedWorkouts(list), completedToday);
        // `today` is a dependency so the lists re-split when the day rolls over.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workouts, today]);

    // "Push A · Week 2": the week is computed from the applied plan, never stored in the name.
    const weekByWorkoutId = useMemo(
        () => getPlanWeekByWorkoutId(plans, workouts ?? []),
        [plans, workouts],
    );
    const nameWithWeek = useCallback(
        (workout: { id: string; name: string }) => {
            const week = weekByWorkoutId.get(workout.id);

            return week
                ? t('home.sessionWithWeek', { ns: 'screens', name: workout.name, week })
                : workout.name;
        },
        [t, weekByWorkoutId],
    );

    const openMissed = useMissedSessionStore((state) => state.open);
    useEffect(() => {
        if (missedPromptShown || !workouts) return;

        const [latestMissed] = getMissedWorkouts(workouts);
        if (!latestMissed) return;

        missedPromptShown = true;
        openMissed(latestMissed.id);
    }, [openMissed, workouts]);

    const { water, distance, sessions, calories, current } = summary;

    // Distance runs as a total so far, so the line climbs to the figure above it.
    const distanceLine = useMemo(() => {
        if (!distance) return [];
        let sum = 0;

        return [0, ...distance.series.slice(0, current + 1).map((value) => (sum += value))];
    }, [current, distance]);

    const sessionParts = [
        { key: 'done', value: sessions.done, highlighted: true },
        { key: 'planned', value: sessions.planned, highlighted: false },
        { key: 'missed', value: sessions.missed, highlighted: false },
    ];
    const sessionTotal = sessions.done + sessions.planned + sessions.missed;

    return (
        <Box style={styles.container}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Greeting accent={ACCENT.distance} />

                <VStack style={styles.section}>
                    <PeriodPicker
                        labels={PERIODS.map((p) => t(`home.dash.periods.${p}`, { ns: 'screens' }))}
                        index={PERIODS.indexOf(period)}
                        onChange={(index) => setPeriod(PERIODS[index])}
                    />

                    <HStack style={styles.row}>
                        <Tile
                            title={t('home.dash.water', { ns: 'screens' })}
                            onPress={() => openMetric('water')}
                        >
                            <Bars data={water.series} current={current} color={ACCENT.water} />
                            <Metric value={water.litres.toFixed(1)} unit="L" color={ACCENT.water} />
                        </Tile>

                        <Tile
                            title={t('home.dash.distance', { ns: 'screens' })}
                            onPress={() => openMetric('distance')}
                        >
                            <Metric
                                value={distance ? distance.total.toFixed(2) : '–'}
                                unit={summary.distanceUnit}
                                color={ACCENT.distance}
                            />
                            {distance ? (
                                <Line data={distanceLine} color={ACCENT.distance} />
                            ) : (
                                <Text style={styles.caption}>
                                    {t('home.dash.noHealth', { ns: 'screens' })}
                                </Text>
                            )}
                        </Tile>
                    </HStack>

                    <Tile
                        title={t('home.dash.sessions', { ns: 'screens' })}
                        onPress={() => openMetric('sessions')}
                    >
                        <HStack style={styles.segments}>
                            {sessionParts.map((part) => (
                                <VStack
                                    key={part.key}
                                    // Proportional, with a floor so an empty part still has its label.
                                    style={[
                                        styles.segment,
                                        {
                                            flex: sessionTotal
                                                ? Math.max(part.value / sessionTotal, 0.2)
                                                : 1,
                                        },
                                    ]}
                                >
                                    <Box
                                        style={[
                                            styles.segmentBar,
                                            {
                                                backgroundColor: ACCENT.sessions,
                                                opacity: part.highlighted ? 1 : 0.3,
                                            },
                                        ]}
                                    />
                                    <Text style={styles.segmentValue(part.highlighted)}>
                                        {part.value}
                                    </Text>
                                    <Text style={styles.caption}>
                                        {t(`home.dash.${part.key}`, { ns: 'screens' })}
                                    </Text>
                                </VStack>
                            ))}
                        </HStack>
                    </Tile>

                    <Tile
                        onPress={() => {
                            setCaloriesDay(today);
                            router.navigate('/calories' as never);
                        }}
                    >
                        <HStack style={styles.target}>
                            <VStack style={styles.stats}>
                                <Text style={styles.targetTitle} accessibilityRole="header">
                                    {t('home.dash.target', { ns: 'screens' })}
                                    {'\n'}
                                    <Text style={[styles.targetTitle, { color: ACCENT.calories }]}>
                                        {t('home.dash.calories', { ns: 'screens' })}
                                    </Text>
                                </Text>
                                <VStack>
                                    <Metric
                                        value={String(calories.target)}
                                        unit="kcal"
                                        color={ACCENT.calories}
                                        size={24}
                                    />
                                    <Text style={styles.caption}>
                                        {t('home.dash.target', { ns: 'screens' })}
                                    </Text>
                                </VStack>
                                <VStack>
                                    <Metric
                                        value={String(calories.remaining)}
                                        unit="kcal"
                                        color={ACCENT.calories}
                                        size={24}
                                    />
                                    <Text style={styles.caption}>
                                        {t('home.dash.remaining', { ns: 'screens' })}
                                    </Text>
                                </VStack>
                            </VStack>
                            <Box style={styles.ring}>
                                <Ring
                                    progress={
                                        calories.target > 0
                                            ? calories.consumed / calories.target
                                            : 0
                                    }
                                    color={ACCENT.calories}
                                    size={RING_SIZE}
                                />
                                <VStack style={styles.ringLabel} pointerEvents="none">
                                    <Metric
                                        value={String(calories.consumed)}
                                        color={ACCENT.calories}
                                        size={28}
                                    />
                                    <Text style={styles.caption}>
                                        {t('home.dash.consumed', { ns: 'screens' })}
                                    </Text>
                                </VStack>
                            </Box>
                        </HStack>
                    </Tile>
                </VStack>

                {workouts ? (
                    <UpNext
                        state={upNext}
                        overviewMeta={
                            upNext.kind === 'create'
                                ? undefined
                                : workoutsOverviewMeta[upNext.workout.id]
                        }
                        displayName={
                            upNext.kind === 'create' ? undefined : nameWithWeek(upNext.workout)
                        }
                        elapsedFormatted={
                            upNext.kind === 'resume' && upNext.workout.id === runningWorkout?.id
                                ? elapsedFormated
                                : null
                        }
                    />
                ) : (
                    <Box
                        style={styles.upNextPlaceholder}
                        accessibilityLabel={t('home.loading', { ns: 'screens' })}
                    />
                )}
            </ScrollView>
            {Platform.OS === 'android' && <Box style={styles.statusBarScrim} />}
        </Box>
    );
};

export default HomeScreen;
