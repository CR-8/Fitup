import { FC, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { useWorkouts, useWorkoutsOverviewMeta, useWeeklyWorkoutStats } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useUser } from '@/hooks/use-user';
import { useAnalytics } from '@/hooks/use-analytics';
import {
    getPlannedWorkouts,
    groupWorkoutsByWeek,
    getInProgressWorkouts,
    summariseWeek,
} from '@/helpers/workouts';
import { formatWorkoutDuration } from '@/helpers/times';
import { readProfileDetails } from '@/crud/onboarding';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';

import { Greeting, Workouts } from './components';
import { resolveUpNext } from './components/up-next/resolve';
import { WeekStatsBlocks, type WeekStatsBlock } from './components/week-stats';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    empty: {
        ...theme.screenContentPadding('root'),
        flex: 1,
        gap: theme.space(6),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
        paddingBottom: rt.insets.bottom + theme.space(16),
        gap: theme.space(7),
    },
    // The reference leads with three short stacked lines rather than a
    // paragraph. It reads as a claim rather than a description.
    emptyHeadline: {
        gap: theme.space(1),
    },
    emptyHeadlineAccent: {
        color: theme.colors.primary,
    },
    emptyDescription: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    // `Button` renders a ReactNode title verbatim, so `styles.title` — which is
    // where the theme-correct colour lives — never reaches these. They have to
    // invert with the button's own fill, which is white in dark mode and near
    // black in light. `primaryTypography` is white in *both*, so it used to
    // render white on white every time the app was in dark mode.
    buttonTitle: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.neutral[50],
        textAlign: 'center',
    },
    buttonDescription: {
        fontSize: theme.fontSize.xs.fontSize,
        textAlign: 'center',
        marginTop: -theme.space(1),
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.neutral[50],
        opacity: 0.8,
    },
}));

const HomeScreen: FC = () => {
    const { navigate } = useEditor();
    const { track } = useAnalytics();
    const { t, i18n } = useTranslation(['screens']);
    const { user } = useUser();

    const firstWeekday = user?.firstWeekday || 2;

    const { data: workouts, isLoading } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);

    // Volume is the only figure that needs a query — it lives on the sets.
    // Sessions and time come out of the rows already loaded above.
    const { volume: weeklyVolume } = useWeeklyWorkoutStats(firstWeekday);

    /**
     * The weekly target the user set during onboarding, which until now was
     * written down and never referred to again.
     */
    const { data: sessionsGoal = null } = useQuery({
        queryKey: ['onboarding', 'sessions-per-week', user?.id],
        queryFn: async () => (await readProfileDetails(user!.id)).sessionsPerWeek,
        enabled: !!user?.id,
        staleTime: 60_000 * 10,
    });

    const handleCreateWorkout = useCallback(() => {
        track('workout:create_requested', { surface: 'home_empty_state' });
        navigate({ type: 'workout__create' });
    }, [navigate, track]);

    const { inProgressWorkouts, plannedWorkouts, completedGroups, hasWorkouts } = useMemo(() => {
        const workoutsList = workouts ?? [];
        const inProgress = getInProgressWorkouts(workoutsList);
        const planned = getPlannedWorkouts(workoutsList);
        const completed = groupWorkoutsByWeek(workoutsList, i18n.language, firstWeekday);
        const hasAny = inProgress.length > 0 || planned.length > 0 || completed.length > 0;

        return {
            inProgressWorkouts: inProgress,
            plannedWorkouts: planned,
            completedGroups: completed,
            hasWorkouts: hasAny,
        };
    }, [workouts, i18n.language, firstWeekday]);

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts),
        [inProgressWorkouts, plannedWorkouts],
    );

    const weekSummary = useMemo(
        () => summariseWeek(workouts ?? [], firstWeekday),
        [workouts, firstWeekday],
    );

    const weightUnits = user?.weightUnits || 'kg';

    const statBlocks = useMemo<WeekStatsBlock[]>(
        () => [
            {
                key: 'sessions',
                // Shown against the goal when there is one, and on its own when
                // onboarding was skipped — rather than inventing a target.
                value:
                    typeof sessionsGoal === 'number' && sessionsGoal > 0
                        ? `${weekSummary.sessions}/${sessionsGoal}`
                        : String(weekSummary.sessions),
                label: t('home.stats.sessions', { ns: 'screens' }),
                emphasised: true,
            },
            {
                key: 'time',
                value:
                    weekSummary.durationSeconds > 0
                        ? formatWorkoutDuration(weekSummary.durationSeconds)
                        : '—',
                label: t('home.stats.time', { ns: 'screens' }),
            },
            {
                key: 'volume',
                value:
                    weeklyVolume > 0
                        ? `${Math.round(weeklyVolume).toLocaleString(i18n.language)}`
                        : '—',
                label: t(`home.stats.volume_${weightUnits}`, { ns: 'screens' }),
            },
        ],
        [i18n.language, sessionsGoal, t, weekSummary, weeklyVolume, weightUnits],
    );

    if (isLoading || !workouts) {
        return null;
    }

    const buttonContent = (
        <VStack>
            <Text style={styles.buttonTitle}>
                {t('home.empty.button.title', { ns: 'screens' })}
            </Text>
            <Text style={styles.buttonDescription}>
                {t('home.empty.button.description', { ns: 'screens' })}
            </Text>
        </VStack>
    );

    if (!hasWorkouts) {
        return (
            <VStack style={styles.empty}>
                <Greeting />
                <VStack style={styles.emptyContainer}>
                    <VStack style={styles.emptyHeadline}>
                        <Title type="h1">{t('home.empty.headline.first', { ns: 'screens' })}</Title>
                        <Title type="h1">
                            {t('home.empty.headline.second', { ns: 'screens' })}
                        </Title>
                        <Title type="h1" style={styles.emptyHeadlineAccent}>
                            {t('home.empty.headline.third', { ns: 'screens' })}
                        </Title>
                        <Text style={styles.emptyDescription}>
                            {t('home.empty.description', { ns: 'screens' })}
                        </Text>
                    </VStack>

                    {/* What the app offers, not the user's zeroes — three noughts
                        is a worse first impression than no numbers at all. */}
                    <WeekStatsBlocks
                        blocks={[
                            {
                                key: 'exercises',
                                value: t('home.empty.stats.exercisesValue', { ns: 'screens' }),
                                label: t('home.empty.stats.exercisesLabel', { ns: 'screens' }),
                                emphasised: true,
                            },
                            {
                                key: 'plan',
                                value: t('home.empty.stats.planValue', { ns: 'screens' }),
                                label: t('home.empty.stats.planLabel', { ns: 'screens' }),
                            },
                            {
                                key: 'sync',
                                value: t('home.empty.stats.syncValue', { ns: 'screens' }),
                                label: t('home.empty.stats.syncLabel', { ns: 'screens' }),
                            },
                        ]}
                    />

                    <Box>
                        <Button size="lg" onPress={handleCreateWorkout} title={buttonContent} />
                    </Box>
                </VStack>
            </VStack>
        );
    }

    return (
        <Box style={styles.container}>
            <Workouts
                workouts={workouts}
                firstWeekday={firstWeekday}
                inProgressWorkouts={inProgressWorkouts}
                plannedWorkouts={plannedWorkouts}
                completedGroups={completedGroups}
                workoutsOverviewMeta={workoutsOverviewMeta}
                upNext={upNext}
                statBlocks={statBlocks}
                weekSessions={weekSummary.sessions}
                sessionsGoal={sessionsGoal}
            />
        </Box>
    );
};

export default HomeScreen;
