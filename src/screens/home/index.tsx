import { FC, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

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
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';

import { Greeting, WorkoutCard } from './components';
import { AiPlanCard } from './components/ai-plan';
import { WeeklyTracker } from './components/weekly-tracker';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { NutritionCard } from './components/nutrition';
import { useAppliedPlans } from '@/hooks/use-ai';
import { summarisePlans } from '@/helpers/ai-plan';

/**
 * Home: the week first.
 *
 * Top to bottom: a greeting, the weekly tracker (this week day by day, and the
 * workouts / rest / active-rest rings), today's workout when there is one to
 * start or resume, the AI plan card in the middle of the screen, the day's food,
 * and the last few sessions.
 *
 * Building a workout by hand is still here but no longer the headline: with
 * nothing scheduled, the big "plan a workout" card gave way to the tracker and
 * the AI card, and a quiet link under the AI card does the same job. The
 * Workout and Exercises tabs are gone — the tracker's days open their workouts,
 * and the Monthly Tracker holds the calendar and history.
 */

/** Home is a glance at recent training, not the archive — that's the Monthly Tracker. */
const RECENT_LIMIT = 3;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        ...Platform.select({
            ios: theme.screenContentPadding('root'),
            // Android has no header here, so the screen clears the status bar itself.
            default: {
                paddingTop: rt.insets.top + theme.space(4),
                paddingBottom: theme.screenContentPadding('root').paddingBottom,
            },
        }),
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
    buildOwn: {
        alignSelf: 'center',
        paddingVertical: theme.space(1),
        paddingHorizontal: theme.space(4),
        marginTop: -theme.space(2),
    },
    buildOwnText: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
    buildOwnLink: {
        color: theme.colors.primary,
        fontWeight: theme.fontWeight.semibold.fontWeight,
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

    const { navigate } = useEditor();
    const { track } = useAnalytics();

    const { inProgressWorkouts, plannedWorkouts, recentWorkouts } = useMemo(() => {
        const list = workouts ?? [];
        const completed = list
            .filter((workout) => workout.status === 'completed' && workout.completedAt)
            .sort(
                (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
            );

        return {
            inProgressWorkouts: getInProgressWorkouts(list),
            plannedWorkouts: getPlannedWorkouts(list),
            recentWorkouts: completed.slice(0, RECENT_LIMIT),
        };
    }, [workouts]);

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts),
        [inProgressWorkouts, plannedWorkouts],
    );

    const streak = useMemo(() => computeStreakDays(workouts ?? []), [workouts]);

    // The running plan drives the tracker's targets; once its sessions are done
    // or its time is up, the AI card says how many are behind you.
    const planSummary = useMemo(() => summarisePlans(plans, workouts ?? []), [plans, workouts]);

    const handleBuildOwn = useCallback(() => {
        track('workout:create_requested', { surface: 'home_up_next' });
        navigate({ type: 'workout__create' });
    }, [navigate, track]);

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

                <WeeklyTracker
                    workouts={workouts}
                    plans={plans}
                    currentPlan={planSummary.current}
                    streak={streak}
                />

                {/* Only when there is something to start or resume. With nothing
                    scheduled, the AI card below is the way forward. */}
                {upNext.kind === 'create' ? null : (
                    <UpNext
                        state={upNext}
                        overviewMeta={workoutsOverviewMeta[upNext.workout.id]}
                        elapsedFormatted={
                            upNext.kind === 'resume' && upNext.workout.id === runningWorkout?.id
                                ? elapsedFormated
                                : null
                        }
                    />
                )}

                {/* Neither while plans load, so the wrong copy never flashes. */}
                {isPlanLoading ? null : (
                    <AiPlanCard
                        finishedPlans={planSummary.finished}
                        hasActivePlan={!!planSummary.current}
                    />
                )}

                {upNext.kind === 'create' ? (
                    <Pressable
                        style={styles.buildOwn}
                        onPress={handleBuildOwn}
                        accessibilityRole="button"
                    >
                        <Text style={styles.buildOwnText}>
                            {t('home.buildOwn.prompt', { ns: 'screens' })}{' '}
                            <Text style={[styles.buildOwnText, styles.buildOwnLink]}>
                                {t('home.buildOwn.action', { ns: 'screens' })}
                            </Text>
                        </Text>
                    </Pressable>
                ) : null}

                <NutritionCard />

                {recentWorkouts.length > 0 ? (
                    <VStack style={styles.recentSection}>
                        <HStack style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                {t('home.recentActivity', { ns: 'screens' })}
                            </Text>
                            <Pressable
                                onPress={() => router.navigate('/results')}
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
