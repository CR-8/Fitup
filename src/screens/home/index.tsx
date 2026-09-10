import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import {
    computeStreakDays,
    getPlannedWorkouts,
    getInProgressWorkouts,
    summariseWeek,
} from '@/helpers/workouts';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import Spinner from '@/components/feedback/spinner';

import { Greeting } from './components';
import { AiPlanCard } from './components/ai-plan';
import { ActivePlanCard } from './components/active-plan';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';
import { WeekStats } from './components/week';
import { StatsRow } from './components/stats-row';
import { QuickActions } from './components/quick-actions';

/**
 * The daily command center.
 *
 * Home used to render the entire workout library — every completed week,
 * paginated — which made it both the dashboard and the workout list, and left
 * "where do I start a workout?" with two different answers. The list lives on
 * the workout tab; what is left here answers one question.
 *
 * The order is the product's own hierarchy, and it changed: Home used to open
 * with the streak, which is a reward for training already done. It now opens
 * with the offer to have Syn write the plan, because that is the thing the app
 * is for and the thing a new account has no way to discover otherwise. Then what
 * you are already on, then the week, then today.
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
}));

const HomeScreen: FC = () => {
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
    // the stats row below, which would otherwise compute the same total again.
    const weekSummary = useMemo(
        () => summariseWeek(workouts ?? [], firstWeekday),
        [workouts, firstWeekday],
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
            <Greeting />

            <AiPlanCard />

            {/* Renders nothing until a plan has been applied, which is most of
                the time for a new account. */}
            <ActivePlanCard workouts={workouts} streak={streak} />

            <WeekStats
                workouts={workouts}
                plannedWorkouts={plannedWorkouts}
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

            <StatsRow weekDurationSeconds={weekSummary.durationSeconds} />

            <QuickActions />
        </ScrollView>
    );
};

export default HomeScreen;
