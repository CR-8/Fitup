import { FC, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useUser } from '@/hooks/use-user';
import { useAnalytics } from '@/hooks/use-analytics';
import { getPlannedWorkouts, groupWorkoutsByWeek, getInProgressWorkouts } from '@/helpers/workouts';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import Spinner from '@/components/feedback/spinner';

import { Workouts } from '@/screens/home/components';
import { resolveUpNext } from '@/screens/home/components/up-next/resolve';
import { UpNext } from '@/screens/home/components/up-next';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';

/**
 * The workout tab.
 *
 * Home used to be the workout list as well as the dashboard, which is what made
 * "start a workout" ambiguous — the same list served two jobs and the entry
 * points disagreed about where they led. This screen owns the list and the
 * sessions; Home is now a summary that points here.
 *
 * Everything below is the existing list rendering, given its own title block
 * rather than the home dashboard header.
 */

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContent: {
        gap: theme.space(5),
        paddingBottom: theme.space(5),
    },
    titleBlock: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(1),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    empty: {
        ...theme.screenContentPadding('root'),
        flex: 1,
        paddingHorizontal: theme.space(4),
        gap: theme.space(5),
    },
    emptyBody: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: rt.insets.bottom + theme.space(16),
        gap: theme.space(4),
    },
    emptyText: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    // The inverted colour that used to be repeated here is `Button`'s own, and
    // is applied as soon as the title is a string rather than a node. Restating
    // it was the only thing keeping this label readable, and the same code on
    // the home screen had drifted.
    buttonTitle: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
    },
}));

const WorkoutHubScreen: FC = () => {
    const { navigate } = useEditor();
    const { track } = useAnalytics();
    const { t, i18n } = useTranslation(['screens']);
    const { user } = useUser();

    const firstWeekday = user?.firstWeekday || 2;

    const { data: workouts, isLoading } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();

    const handleCreateWorkout = useCallback(() => {
        track('workout:create_requested', { surface: 'workout_tab' });
        navigate({ type: 'workout__create' });
    }, [navigate, track]);

    const { inProgressWorkouts, plannedWorkouts, completedGroups, hasWorkouts } = useMemo(() => {
        const workoutsList = workouts ?? [];
        const inProgress = getInProgressWorkouts(workoutsList);
        const planned = getPlannedWorkouts(workoutsList);
        const completed = groupWorkoutsByWeek(workoutsList, i18n.language, firstWeekday);

        return {
            inProgressWorkouts: inProgress,
            plannedWorkouts: planned,
            completedGroups: completed,
            hasWorkouts: inProgress.length > 0 || planned.length > 0 || completed.length > 0,
        };
    }, [workouts, i18n.language, firstWeekday]);

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts),
        [inProgressWorkouts, plannedWorkouts],
    );

    const header = useMemo(
        () => (
            <VStack style={styles.headerContent}>
                <VStack style={styles.titleBlock}>
                    <Title type="h1">{t('workoutHub.title', { ns: 'screens' })}</Title>
                    <Text style={styles.subtitle}>
                        {t('workoutHub.subtitle', { ns: 'screens' })}
                    </Text>
                </VStack>
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
            </VStack>
        ),
        [elapsedFormated, runningWorkout?.id, t, upNext, workoutsOverviewMeta],
    );

    if (isLoading || !workouts) {
        return (
            <Box style={styles.loading}>
                <Spinner />
            </Box>
        );
    }

    if (!hasWorkouts) {
        return (
            <VStack style={styles.empty}>
                <VStack style={styles.titleBlock}>
                    <Title type="h1">{t('workoutHub.title', { ns: 'screens' })}</Title>
                </VStack>
                <VStack style={styles.emptyBody}>
                    <Title type="h3">{t('workoutHub.empty.title', { ns: 'screens' })}</Title>
                    <Text style={styles.emptyText}>
                        {t('workoutHub.empty.description', { ns: 'screens' })}
                    </Text>
                    <Button
                        size="lg"
                        onPress={handleCreateWorkout}
                        title={t('workoutHub.empty.action', { ns: 'screens' })}
                        textStyle={styles.buttonTitle}
                    />
                </VStack>
            </VStack>
        );
    }

    return (
        <Box style={styles.container}>
            <Workouts
                inProgressWorkouts={inProgressWorkouts}
                plannedWorkouts={plannedWorkouts}
                completedGroups={completedGroups}
                workoutsOverviewMeta={workoutsOverviewMeta}
                upNext={upNext}
                header={header}
            />
        </Box>
    );
};

export default WorkoutHubScreen;
