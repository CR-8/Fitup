import { FC, useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useUser } from '@/hooks/use-user';
import { useAnalytics } from '@/hooks/use-analytics';
import {
    getInProgressWorkouts,
    getMissedWorkouts,
    getPlannedWorkouts,
    groupWorkoutsByWeek,
} from '@/helpers/workouts';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import Spinner from '@/components/feedback/spinner';

import type { WorkoutSelect } from '@/db/schema';
import { Workouts } from '@/screens/home/components';
import { WeekStrip } from './components/week-strip';

/** The day a session belongs to on the strip, as a local-midnight timestamp. */
const dayOf = (workout: WorkoutSelect): number | null => {
    const at =
        workout.status === 'completed'
            ? workout.completedAt
            : (workout.startAt ?? workout.startedAt);

    return at ? dayjs(at).startOf('day').valueOf() : null;
};

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
        gap: theme.space(4),
        paddingBottom: theme.space(4),
    },
    dayEmpty: {
        ...theme.fontSize.sm,
        paddingHorizontal: theme.space(4),
        color: theme.colors.mutedTypography,
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
        // Android's tab bar floats over the content; iOS insets for its own.
        paddingBottom: Platform.select({
            ios: theme.space(16),
            default: rt.insets.bottom + theme.space(16),
        }),
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

    // The reference's day strip: choosing a day shows just that day's sessions.
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const handleCreateWorkout = useCallback(() => {
        track('workout:create_requested', { surface: 'workout_tab' });
        navigate({ type: 'workout__create' });
    }, [navigate, track]);

    const {
        inProgressWorkouts,
        plannedWorkouts,
        missedWorkouts,
        completedGroups,
        hasWorkouts,
        dayIsEmpty,
    } = useMemo(() => {
        const workoutsList = workouts ?? [];
        const onDay = (workout: WorkoutSelect) =>
            selectedDay === null || dayOf(workout) === selectedDay;
        const inProgress = getInProgressWorkouts(workoutsList).filter(onDay);
        const planned = getPlannedWorkouts(workoutsList).filter(onDay);
        const missed = getMissedWorkouts(workoutsList).filter(onDay);
        const completed = groupWorkoutsByWeek(workoutsList, i18n.language, firstWeekday)
            .map((group) => ({ ...group, workouts: group.workouts.filter(onDay) }))
            .filter((group) => group.workouts.length > 0);
        const any =
            inProgress.length > 0 ||
            planned.length > 0 ||
            missed.length > 0 ||
            completed.length > 0;

        return {
            inProgressWorkouts: inProgress,
            plannedWorkouts: planned,
            missedWorkouts: missed,
            completedGroups: completed,
            hasWorkouts: any || (selectedDay !== null && workoutsList.length > 0),
            dayIsEmpty: selectedDay !== null && !any,
        };
    }, [workouts, i18n.language, firstWeekday, selectedDay]);

    const header = useMemo(
        () => (
            <VStack style={styles.headerContent}>
                <WeekStrip
                    workouts={workouts ?? []}
                    overviewMeta={workoutsOverviewMeta}
                    firstWeekday={firstWeekday}
                    selected={selectedDay}
                    onSelect={setSelectedDay}
                />
                {dayIsEmpty ? (
                    <Text style={styles.dayEmpty}>
                        {t('workoutHub.dayEmpty', {
                            ns: 'screens',
                            day: dayjs(selectedDay!).locale(i18n.language).format('dddd D MMM'),
                        })}
                    </Text>
                ) : null}
            </VStack>
        ),
        [dayIsEmpty, firstWeekday, i18n.language, selectedDay, t, workouts, workoutsOverviewMeta],
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
                missedWorkouts={missedWorkouts}
                completedGroups={completedGroups}
                workoutsOverviewMeta={workoutsOverviewMeta}
                header={header}
            />
        </Box>
    );
};

export default WorkoutHubScreen;
