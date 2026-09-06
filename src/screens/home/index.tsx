import { FC, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useUser } from '@/hooks/use-user';
import { useAnalytics } from '@/hooks/use-analytics';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import {
    computeStreakDays,
    getPlannedWorkouts,
    getInProgressWorkouts,
    summariseWeek,
} from '@/helpers/workouts';
import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Pressable } from '@/components/primitives/pressable';
import Spinner from '@/components/feedback/spinner';
import { Pushes } from '@/components/promo/pushes';

import { Greeting, WorkoutCard } from './components';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { WeekStats } from './components/week';
import { StreakCard } from './components/streak-card';
import { QuickActions } from './components/quick-actions';

/**
 * The daily command center.
 *
 * Home used to render the entire workout library — every completed week,
 * paginated — which made it both the dashboard and the workout list, and left
 * "where do I start a workout?" with two different answers. The list now lives
 * on the workout tab. What is left here answers one question: what should I do
 * today?
 *
 * Order is deliberate and matches the product hierarchy: who you are, what you
 * have going, what to do next, then the ways elsewhere.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(5),
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
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    sectionLink: {
        ...theme.fontSize.sm,
        color: theme.colors.primary,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    recent: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(2),
    },
    emptyBlock: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(5),
        gap: theme.space(2),
    },
    emptyTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    emptyDescription: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    emptyAction: {
        marginTop: theme.space(2),
    },
    buttonTitle: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
    },
}));

/** Home shows a glance at recent training, not the archive. */
const RECENT_LIMIT = 3;

const HomeScreen: FC = () => {
    const { navigate } = useEditor();
    const { track } = useAnalytics();
    const { t } = useTranslation(['screens']);
    const { user } = useUser();

    const firstWeekday = user?.firstWeekday || 2;

    const { data: workouts, isLoading } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();

    const handleCreateWorkout = useCallback(() => {
        track('workout:create_requested', { surface: 'home_empty_state' });
        navigate({ type: 'workout__create' });
    }, [navigate, track]);

    const { inProgressWorkouts, plannedWorkouts, recentWorkouts } = useMemo(() => {
        const list = workouts ?? [];

        return {
            inProgressWorkouts: getInProgressWorkouts(list),
            plannedWorkouts: getPlannedWorkouts(list),
            recentWorkouts: list
                .filter((workout) => workout.status === 'completed' && workout.completedAt)
                .sort(
                    (a, b) =>
                        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
                )
                .slice(0, RECENT_LIMIT),
        };
    }, [workouts]);

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts),
        [inProgressWorkouts, plannedWorkouts],
    );

    const streak = useMemo(() => computeStreakDays(workouts ?? []), [workouts]);

    // The strip's caption reports the real week, not a placeholder.
    const weekSummary = useMemo(
        () => summariseWeek(workouts ?? [], firstWeekday),
        [workouts, firstWeekday],
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
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            <Greeting />

            <StreakCard streak={streak} />

            <WeekStats
                workouts={workouts}
                firstWeekday={firstWeekday}
                sessions={weekSummary.sessions}
                sessionsGoal={null}
            />

            <UpNext
                state={upNext}
                overviewMeta={
                    upNext.kind === 'create' ? undefined : workoutsOverviewMeta[upNext.workout.id]
                }
                elapsedFormatted={
                    upNext.kind === 'resume' && upNext.workout.id === runningWorkout?.id
                        ? elapsedFormated
                        : null
                }
            />

            <QuickActions />

            <Pushes />

            <HStack style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    {t('home.recentActivity', { ns: 'screens' })}
                </Text>
                {recentWorkouts.length > 0 ? (
                    <Pressable
                        onPress={() => router.navigate('/workouts')}
                        accessibilityRole="button"
                    >
                        <Text style={styles.sectionLink}>
                            {t('home.viewAll', { ns: 'screens' })}
                        </Text>
                    </Pressable>
                ) : null}
            </HStack>

            {recentWorkouts.length > 0 ? (
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
            ) : (
                <VStack style={styles.emptyBlock}>
                    <Text style={styles.emptyTitle}>
                        {t('home.recentEmpty.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.emptyDescription}>
                        {t('home.recentEmpty.description', { ns: 'screens' })}
                    </Text>
                    <Box style={styles.emptyAction}>
                        <Button
                            size="sm"
                            onPress={handleCreateWorkout}
                            title={
                                <Title type="h6" style={styles.buttonTitle}>
                                    {t('home.recentEmpty.action', { ns: 'screens' })}
                                </Title>
                            }
                        />
                    </Box>
                </VStack>
            )}
        </ScrollView>
    );
};

export default HomeScreen;
