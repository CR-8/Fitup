import { FC, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { BarChart3, Flame } from 'lucide-react-native';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { computeStreakDays, getPlannedWorkouts, getInProgressWorkouts } from '@/helpers/workouts';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import Spinner from '@/components/feedback/spinner';
import { StatBlocks, type StatBlock } from '@/components/layout/stat-blocks';

import { Greeting, WorkoutCard } from './components';
import { AiPlanCard } from './components/ai-plan';
import { ActivePlanCard } from './components/active-plan';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { NutritionCard } from './components/nutrition';
import { useAppliedPlans } from '@/hooks/use-ai';
import { summarisePlans } from '@/helpers/ai-plan';

/**
 * The daily command center, laid out after the design board.
 *
 * Top to bottom it answers, in order: who you are, what to do right now, how
 * you're doing, what you've eaten today, and what you did last. The AI plan cards
 * follow — kept below the board's layout rather than dropped, because Syn's plans
 * are the one feature that has no other home here. `NutritionCard` is the way
 * into `/diet`: the tab bar has no Nutrition slot.
 */

/** Home is a glance at recent training, not the archive — that's the Workout tab. */
const RECENT_LIMIT = 3;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        // The screen has no header, so it clears the status bar itself.
        paddingTop: rt.insets.top + theme.space(4),
        paddingBottom: theme.screenContentPadding('root').paddingBottom,
        gap: theme.space(5),
    },
    /** Keeps scrolled cards from running under the clock and battery icons. */
    statusBarScrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: rt.insets.top,
        backgroundColor: theme.colors.background,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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

    const { data: workouts, isLoading } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { plans, isLoading: isPlanLoading } = useAppliedPlans();
    const { elapsedFormated } = useRunningWorkoutTicker();

    const { inProgressWorkouts, plannedWorkouts, recentWorkouts, monthCount } = useMemo(() => {
        const list = workouts ?? [];
        const completed = list
            .filter((workout) => workout.status === 'completed' && workout.completedAt)
            .sort(
                (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
            );
        const monthStart = dayjs().startOf('month');

        return {
            inProgressWorkouts: getInProgressWorkouts(list),
            plannedWorkouts: getPlannedWorkouts(list),
            recentWorkouts: completed.slice(0, RECENT_LIMIT),
            monthCount: completed.filter(
                (workout) => !dayjs(workout.completedAt).isBefore(monthStart),
            ).length,
        };
    }, [workouts]);

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts),
        [inProgressWorkouts, plannedWorkouts],
    );

    const streak = useMemo(() => computeStreakDays(workouts ?? []), [workouts]);

    // A plan stays on Home while it is running; once its sessions are done or its
    // time is up, the generate card comes back and says how many are behind you.
    const planSummary = useMemo(() => summarisePlans(plans, workouts ?? []), [plans, workouts]);

    const tiles = useMemo<StatBlock[]>(
        () => [
            {
                key: 'streak',
                icon: Flame,
                value: String(streak),
                label: t('home.tiles.streak', { ns: 'screens' }),
            },
            {
                key: 'month',
                icon: BarChart3,
                value: String(monthCount),
                label: t('home.tiles.month', { ns: 'screens' }),
            },
        ],
        [monthCount, streak, t],
    );

    const handleWorkoutPress = useCallback((workoutId: string) => {
        router.navigate(`/workout/${workoutId}`);
    }, []);

    if (isLoading || !workouts) {
        return (
            <Box style={styles.loading}>
                <Spinner />
            </Box>
        );
    }

    return (
        <Box style={styles.container}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Greeting />

                <UpNext
                    state={upNext}
                    overviewMeta={
                        upNext.kind === 'create'
                            ? undefined
                            : workoutsOverviewMeta[upNext.workout.id]
                    }
                    elapsedFormatted={
                        upNext.kind === 'resume' && upNext.workout.id === runningWorkout?.id
                            ? elapsedFormated
                            : null
                    }
                />

                <StatBlocks blocks={tiles} variant="split" />

                <NutritionCard />

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

                {/* One or the other: with a plan running, offering to generate a new
                one competes with the plan itself. Neither while it loads, so the
                wrong card never flashes. */}
                {isPlanLoading ? null : planSummary.current ? (
                    <ActivePlanCard workouts={workouts} streak={streak} />
                ) : (
                    <AiPlanCard finishedPlans={planSummary.finished} />
                )}
            </ScrollView>
            <Box style={styles.statusBarScrim} />
        </Box>
    );
};

export default HomeScreen;
