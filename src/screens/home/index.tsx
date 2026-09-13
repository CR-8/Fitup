import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { useWorkouts, useWorkoutsOverviewMeta, useWorkoutStats } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useLatestMeasurementsByMetric } from '@/hooks/use-measurements';
import { convertWeight } from '@/helpers/units';
import {
    computeStreakDays,
    getPlannedWorkouts,
    getInProgressWorkouts,
    summariseWeek,
} from '@/helpers/workouts';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import Spinner from '@/components/feedback/spinner';
import { StatBlocks, type StatBlock } from '@/components/layout/stat-blocks';

import { Greeting } from './components';
import { AiPlanCard } from './components/ai-plan';
import { ActivePlanCard } from './components/active-plan';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { WeekStats } from './components/week';
import { QuickActions } from './components/quick-actions';

/**
 * The daily command center.
 *
 * Home used to render the entire workout library — every completed week,
 * paginated — which made it both the dashboard and the workout list, and left
 * "where do I start a workout?" with two different answers. The list lives on
 * the workout tab; what is left here answers one question.
 *
 * The order answers that question first: what to do right now (Up Next),
 * what's already under way, this week's shape, then the offer to have Syn
 * plan ahead — an offer, not a session, so it sits below the things that are.
 *
 * Recent activity and the notifications promo were deliberately removed rather
 * than mislaid. Past workouts live on the Workouts tab, which still has its own
 * place on the bar, and the promo is a one-time nudge Settings already covers —
 * both were competing with the two cards above for the same attention.
 *
 * `QuickActions` stays, though the design this screen follows has no row like
 * it, for one blunt reason: it holds the only link to `/diet` anywhere in the
 * app. The tab bar has no Nutrition slot, so removing the row would leave the
 * whole Nutrition feature built, routed, and unreachable.
 */

const EMPTY_STAT = '—';

/** 1,940 reads as 1.9k; below a thousand the exact number is more use. */
const compactVolume = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(Math.round(value));

const formatWeekDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;

    return `${hours}h ${minutes}m`;
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    // Groups replace one flat gap: tight within a pair that belongs together
    // (what to do now + its state; the week + this week's totals), wide
    // between groups — so the screen reads as sections, not a card list.
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(7),
    },
    tightGroup: {
        gap: theme.space(3),
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

const HomeScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { user } = useUser();

    const firstWeekday = user?.firstWeekday || 2;

    const { data: workouts, isLoading } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();

    const { inProgressWorkouts, plannedWorkouts } = useMemo(() => {
        const list = workouts ?? [];

        return {
            inProgressWorkouts: getInProgressWorkouts(list),
            plannedWorkouts: getPlannedWorkouts(list),
        };
    }, [workouts]);

    const upNext = useMemo(
        () => resolveUpNext(inProgressWorkouts, plannedWorkouts),
        [inProgressWorkouts, plannedWorkouts],
    );

    const streak = useMemo(() => computeStreakDays(workouts ?? []), [workouts]);

    // The strip's caption reports the real week, not a placeholder. Shared with
    // the stat blocks below, which would otherwise compute the same total again.
    const weekSummary = useMemo(
        () => summariseWeek(workouts ?? [], firstWeekday),
        [workouts, firstWeekday],
    );

    // Three figures under the up-next card: what has been lifted, how long
    // this week took, and what the user weighs. A figure with no data reads
    // as an em dash rather than a zero — "0 kg lifted" is a claim about a
    // user who has trained and lifted nothing; a dash says the app hasn't
    // been told yet, which on a fresh account is the truth.
    const workoutStats = useWorkoutStats();
    const latestMeasurements = useLatestMeasurementsByMetric(useMemo(() => ['body_weight'], []));
    const weightUnit = user?.bodyWeightUnits ?? 'kg';

    // Measurements are stored in kilograms regardless of what the user reads
    // them in, so the conversion happens here rather than in the display.
    const bodyWeight = useMemo(() => {
        const value = latestMeasurements.body_weight?.value;

        if (typeof value !== 'number') return null;

        return weightUnit === 'lb' ? convertWeight(value, 'kg', 'lb') : value;
    }, [latestMeasurements.body_weight?.value, weightUnit]);

    const statBlocks = useMemo<StatBlock[]>(
        () => [
            {
                key: 'volume',
                value: workoutStats.volume ? compactVolume(workoutStats.volume) : EMPTY_STAT,
                label: t(`home.stats.volume_${user?.weightUnits ?? 'kg'}`, { ns: 'screens' }),
            },
            {
                key: 'week',
                value:
                    weekSummary.durationSeconds > 0
                        ? formatWeekDuration(weekSummary.durationSeconds)
                        : EMPTY_STAT,
                label: t('home.thisWeek', { ns: 'screens' }),
            },
            {
                key: 'weight',
                value: bodyWeight === null ? EMPTY_STAT : String(Math.round(bodyWeight * 10) / 10),
                label: t(`common:weightUnit.${weightUnit}`),
            },
        ],
        [
            bodyWeight,
            t,
            user?.weightUnits,
            weekSummary.durationSeconds,
            weightUnit,
            workoutStats.volume,
        ],
    );

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
            <VStack style={styles.tightGroup}>
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
            </VStack>

            {/* Renders nothing until a plan has been applied, which is most of
                the time for a new account. */}
            <ActivePlanCard workouts={workouts} streak={streak} />

            <VStack style={styles.tightGroup}>
                <WeekStats
                    workouts={workouts}
                    plannedWorkouts={plannedWorkouts}
                    firstWeekday={firstWeekday}
                    sessions={weekSummary.sessions}
                    sessionsGoal={null}
                />

                <StatBlocks blocks={statBlocks} variant="split" />
            </VStack>

            <AiPlanCard />

            <QuickActions />
        </ScrollView>
    );
};

export default HomeScreen;
