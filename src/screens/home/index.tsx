import { FC, useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import dayjs from 'dayjs';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { getInProgressWorkouts, getMissedWorkouts, getPlannedWorkouts } from '@/helpers/workouts';
import { getPlanWeekByWorkoutId } from '@/helpers/ai-plan';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { useMissedSessionStore } from '@/stores/missed-session';
import { useAppliedPlans } from '@/hooks/use-ai';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { StatBlocks, type StatBlock } from '@/components/layout/stat-blocks';
import { useTodayKey } from '@/hooks/use-water';

import { Greeting, WorkoutCard } from './components';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { NutritionCard } from './components/nutrition';
import { SynNudge } from './components/syn-nudge';
import { HydrationCard } from './components/hydration';
import { DailySummary } from './components/daily-summary';
import { AllowanceRow } from './components/allowance';

/**
 * Today, in the brief's order: the day so far, what to do now, water, food,
 * the week, the month's plan builds, one line from Syn, and what you did last.
 * Starting a workout is the only filled button on the screen.
 *
 * The shell renders at once and each card loads (and fails) on its own: only
 * the workout card waits for the workouts query, behind a placeholder.
 */

/** Today is a glance at recent training, not the archive: that is Plan. */
const RECENT_LIMIT = 3;

/** The missed-session sheet is offered once per app open, not on every visit to Today. */
let missedPromptShown = false;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        ...Platform.select({
            // The scroll view insets itself from the status bar on iOS.
            ios: { paddingTop: theme.space(4) },
            // Android has no header here, so the screen clears the status bar itself.
            default: { paddingTop: rt.insets.top + theme.space(4) },
        }),
        paddingBottom: theme.screenContentPadding('root').paddingBottom,
        gap: theme.space(5),
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
    /** Holds Up Next's place while the workouts load, so nothing below jumps. */
    upNextPlaceholder: {
        marginHorizontal: theme.space(4),
        height: 196,
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.foreground,
    },
    sectionHeader: {
        paddingHorizontal: theme.space(4),
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    sectionLink: {
        ...theme.fontSize.sm,
        color: theme.colors.primary,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    recentSection: {
        gap: theme.space(3),
    },
    recent: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(2),
    },
}));

const HomeScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const today = useTodayKey();

    const { data: workouts } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { plans } = useAppliedPlans();
    const { elapsedFormated } = useRunningWorkoutTicker();
    const { done: weekDone, target: weekTarget } = useWeeklyStreak();

    const {
        inProgressWorkouts,
        plannedWorkouts,
        missedWorkouts,
        completedToday,
        plannedToday,
        recentWorkouts,
        monthCount,
        totalCount,
    } = useMemo(() => {
        const list = workouts ?? [];
        const completed = list
            .filter((workout) => workout.status === 'completed' && workout.completedAt)
            .sort(
                (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
            );
        const monthStart = dayjs().startOf('month');
        const planned = getPlannedWorkouts(list);

        return {
            inProgressWorkouts: getInProgressWorkouts(list),
            plannedWorkouts: planned,
            plannedToday: planned.filter(
                (workout) => !!workout.startAt && dayjs(workout.startAt).isSame(dayjs(), 'day'),
            ),
            missedWorkouts: getMissedWorkouts(list),
            completedToday: completed.filter((workout) =>
                dayjs(workout.completedAt).isSame(dayjs(), 'day'),
            ),
            recentWorkouts: completed.slice(0, RECENT_LIMIT),
            monthCount: completed.filter(
                (workout) => !dayjs(workout.completedAt).isBefore(monthStart),
            ).length,
            totalCount: completed.length,
        };
        // `today` is a dependency so the lists re-split when the day rolls over.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workouts, today]);

    const training = workouts
        ? {
              done: completedToday.length,
              total: completedToday.length + inProgressWorkouts.length + plannedToday.length,
          }
        : null;

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts, completedToday),
        [completedToday, inProgressWorkouts, plannedWorkouts],
    );

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

    const tiles = useMemo<StatBlock[]>(
        () => [
            {
                key: 'week',
                value: t('home.tiles.streakValue', {
                    ns: 'screens',
                    done: weekDone,
                    target: weekTarget,
                }),
                label: t('home.tiles.streak', { ns: 'screens' }),
            },
            {
                key: 'month',
                value: String(monthCount),
                label: t('home.tiles.month', { ns: 'screens' }),
            },
            {
                key: 'total',
                value: String(totalCount),
                label: t('home.tiles.total', { ns: 'screens' }),
            },
        ],
        [monthCount, t, totalCount, weekDone, weekTarget],
    );

    const nudge = missedWorkouts[0]
        ? t('home.nudge.missed', { ns: 'screens', name: missedWorkouts[0].name })
        : plans.length === 0
          ? t('home.nudge.noPlan', { ns: 'screens' })
          : t('home.nudge.default', { ns: 'screens' });

    const handleWorkoutPress = useCallback((workoutId: string) => {
        router.navigate(`/workout/${workoutId}`);
    }, []);

    return (
        <Box style={styles.container}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Greeting />

                <DailySummary date={today} training={training} />

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

                <HydrationCard date={today} />

                <NutritionCard />

                <StatBlocks blocks={tiles} variant="split" />

                <AllowanceRow />

                <SynNudge message={nudge} />

                {recentWorkouts.length > 0 ? (
                    <VStack style={styles.recentSection}>
                        <HStack style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                {t('home.recentActivity', { ns: 'screens' })}
                            </Text>
                            <Pressable
                                onPress={() => router.navigate('/workouts')}
                                accessibilityRole="button"
                            >
                                <Text style={styles.sectionLink}>
                                    {t('home.viewAll', { ns: 'screens' })}
                                </Text>
                            </Pressable>
                        </HStack>
                        <VStack style={styles.recent}>
                            {recentWorkouts.map((workout) => (
                                <WorkoutCard
                                    key={workout.id}
                                    workout={workout}
                                    onPress={handleWorkoutPress}
                                    activeElapsedFormatted={null}
                                    overviewMeta={workoutsOverviewMeta[workout.id]}
                                />
                            ))}
                        </VStack>
                    </VStack>
                ) : null}
            </ScrollView>
            {Platform.OS === 'android' && <Box style={styles.statusBarScrim} />}
        </Box>
    );
};

export default HomeScreen;
