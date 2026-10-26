import { FC, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { getInProgressWorkouts, getMissedWorkouts, getPlannedWorkouts } from '@/helpers/workouts';
import { getPlanWeekByWorkoutId, planStatus } from '@/helpers/ai-plan';
import { createdWorkoutIds } from '@/ai/apply-plan';
import { useMissedSessionStore } from '@/stores/missed-session';
import { useAppliedPlans } from '@/hooks/use-ai';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { useTodayKey } from '@/hooks/use-water';
import { Skeleton } from '@/components/feedback/skeleton';

import { Greeting } from './components';
import { UpNext } from './components/up-next';
import { resolveUpNext } from './components/up-next/resolve';

import {
    AwardsCard,
    DistanceCard,
    SessionsCard,
    WaterCard,
    SummaryIntro,
} from './components/cards';
import { RingsCard } from './components/rings';
import { WeekCard } from './components/week';
import { toRows, useSummaryLayout, type SummaryCard } from '@/stores/summary-layout';

/**
 * Today: the dial (water, distance, the week's sessions), the week day by day,
 * the awards shelf, then the workout to do now and the per-period cards, in the
 * order the person chose (Edit Home Screen). The charts are native SwiftUI on
 * iOS and drawn by the app on Android (`components/charts`).
 */

/** The missed-session sheet is offered once per app open, not on every visit to Today. */
let missedPromptShown = false;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    // No navigation bar here, on either platform, so the screen clears the
    // status bar itself (iOS's automatic inset did not, and the title sat under
    // the clock) and the tab bar (and a running workout above it) at the bottom.
    content: {
        paddingTop: rt.insets.top + theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(36),
        gap: theme.space(4),
    },
    /** Keeps scrolled cards from running under the clock and battery icons. */
    statusBarScrim: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: rt.insets.top,
        backgroundColor: 'rgba(8, 9, 11, 0.94)',
    },
    section: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    row: {
        gap: theme.space(3),
    },
    cell: {
        flex: 1,
    },
}));

const HomeScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const today = useTodayKey();

    const { data: workouts } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { plans, isLoading: plansLoading } = useAppliedPlans();
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
        if (missedPromptShown || !workouts || plansLoading) return;

        // A plan that has run its course is over: its untrained sessions stay
        // in history as missed, but are not offered again.
        const ended = new Set(
            plans
                .filter((plan) => planStatus(plan) === 'ended')
                .flatMap((plan) => createdWorkoutIds(plan.appliedWorkoutIds)),
        );
        const [latestMissed] = getMissedWorkouts(workouts).filter((w) => !ended.has(w.id));
        if (!latestMissed) return;

        missedPromptShown = true;
        openMissed(latestMissed.id);
    }, [openMissed, plans, plansLoading, workouts]);

    const { cards, introDismissed, dismissIntro } = useSummaryLayout();
    const rows = useMemo(() => toRows(cards), [cards]);

    const renderCard = (card: SummaryCard) => {
        switch (card) {
            case 'workout':
                return workouts ? (
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
                    <Box accessibilityLabel={t('home.loading', { ns: 'screens' })}>
                        <Skeleton height={196} radius={22} />
                    </Box>
                );
            case 'water':
                return <WaterCard today={today} />;
            case 'distance':
                return <DistanceCard today={today} />;
            case 'sessions':
                return <SessionsCard today={today} />;
            case 'rings':
                return <RingsCard today={today} />;
            case 'week':
                return <WeekCard today={today} />;
            case 'awards':
                return <AwardsCard today={today} />;
        }
    };

    return (
        <Box style={styles.container}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                contentInsetAdjustmentBehavior="never"
                showsVerticalScrollIndicator={false}
            >
                <Greeting />

                <VStack style={styles.section}>
                    {introDismissed ? null : <SummaryIntro onDismiss={dismissIntro} />}

                    {rows.map((row) => (
                        <HStack key={row.join('+')} style={styles.row}>
                            {row.map((card) => (
                                <Box key={card} style={styles.cell}>
                                    {renderCard(card)}
                                </Box>
                            ))}
                        </HStack>
                    ))}
                </VStack>
            </ScrollView>
            <Box style={styles.statusBarScrim} pointerEvents="none" />
        </Box>
    );
};

export default HomeScreen;
