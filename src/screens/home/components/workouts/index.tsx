import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { WorkoutSelect } from '@/db/schema';
import { HStack } from '@/components/primitives/hstack';
import { getPlanWeekByWorkoutId } from '@/helpers/ai-plan';
import { WorkoutGroup } from '@/helpers/workouts';
import { useAppliedPlans } from '@/hooks/use-ai';
import { useMealSummaries } from '@/hooks/use-nutrition';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useMissedSessionStore } from '@/stores/missed-session';
import type { WorkoutOverviewMetaMap } from '@/hooks/use-workouts';

import { WorkoutCard } from '../workout-card';

type WorkoutSectionType = 'in_progress' | 'planned' | 'missed' | 'completed';

type CardItem = {
    type: 'card';
    key: string;
    workout: WorkoutSelect;
    section: WorkoutSectionType;
    isFirstInSection: boolean;
};

/** "Today", "Missed", "Wed 14 Oct": a heading, with an optional line on its right. */
type DayHeaderItem = {
    type: 'day_header';
    key: string;
    title: string;
    detail?: string;
    hasTopSpacing: boolean;
};

type CompletedHeaderItem = {
    type: 'completed_header';
    key: string;
    title: string;
    workoutsCount: number;
    hasTopSpacing: boolean;
};

type WorkoutsListItem = CardItem | DayHeaderItem | CompletedHeaderItem;

const COMPLETED_WEEKS_PAGE_SIZE = 5;
const UNSCHEDULED = 'unscheduled';

interface WorkoutsProps {
    inProgressWorkouts: WorkoutSelect[];
    plannedWorkouts: WorkoutSelect[];
    missedWorkouts?: WorkoutSelect[];
    completedGroups: WorkoutGroup[];
    workoutsOverviewMeta: WorkoutOverviewMetaMap;
    /** What sits above the list. Supplied by the screen that owns it. */
    header: ReactNode;
}

const styles = StyleSheet.create((theme) => ({
    listContainer: {
        flex: 1,
    },
    listContent: {
        // The tab bar is cleared by the content inset the list is given below on
        // iOS; on Android `screenContentPadding('root')` reserves room for it.
        ...theme.screenContentPadding('root'),
    },
    sectionHeaderContainer: (hasTopSpacing: boolean) => ({
        paddingHorizontal: theme.space(4),
        marginTop: hasTopSpacing ? theme.space(6) : 0,
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: theme.space(3),
    }),
    sectionHeader: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    sectionDetail: {
        ...theme.fontSize.sm,
        flexShrink: 1,
        color: theme.colors.mutedTypography,
    },
    workoutsCount: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    cardContainer: (isFirstInSection: boolean) => ({
        paddingHorizontal: theme.space(4),
        marginTop: isFirstInSection ? theme.space(3) : theme.space(2),
    }),
}));

const dayKey = (workout: WorkoutSelect): string =>
    workout.startAt ? dayjs(workout.startAt).format('YYYY-MM-DD') : UNSCHEDULED;

export const Workouts: FC<WorkoutsProps> = ({
    inProgressWorkouts,
    plannedWorkouts,
    missedWorkouts = [],
    completedGroups,
    workoutsOverviewMeta,
    header,
}) => {
    const { t, i18n } = useTranslation(['screens']);
    const router = useRouter();
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();
    const { plans } = useAppliedPlans();

    const allWorkouts = useMemo(
        () => [...inProgressWorkouts, ...plannedWorkouts, ...missedWorkouts],
        [inProgressWorkouts, missedWorkouts, plannedWorkouts],
    );
    const weekByWorkoutId = useMemo(
        () => getPlanWeekByWorkoutId(plans, allWorkouts),
        [allWorkouts, plans],
    );
    const synWorkoutIds = useMemo(
        () => new Set(plans.flatMap((plan) => plan.appliedWorkoutIds ?? [])),
        [plans],
    );
    const nameWithWeek = useCallback(
        (workout: WorkoutSelect) => {
            const week = weekByWorkoutId.get(workout.id);

            return week
                ? t('home.sessionWithWeek', { ns: 'screens', name: workout.name, week })
                : workout.name;
        },
        [t, weekByWorkoutId],
    );

    const plannedDayKeys = useMemo(
        () => Array.from(new Set(plannedWorkouts.map(dayKey))).filter((key) => key !== UNSCHEDULED),
        [plannedWorkouts],
    );
    const mealSummaries = useMealSummaries(plannedDayKeys);

    const completedGroupsKey = useMemo(
        () => completedGroups.map((group) => `${group.id}:${group.workouts.length}`).join('|'),
        [completedGroups],
    );
    const [visibleCompletedWeeksState, setVisibleCompletedWeeksState] = useState({
        key: completedGroupsKey,
        count: COMPLETED_WEEKS_PAGE_SIZE,
    });

    const visibleCompletedWeeksCount =
        visibleCompletedWeeksState.key === completedGroupsKey
            ? visibleCompletedWeeksState.count
            : COMPLETED_WEEKS_PAGE_SIZE;

    const visibleCompletedGroups = useMemo(
        () => completedGroups.slice(0, visibleCompletedWeeksCount),
        [completedGroups, visibleCompletedWeeksCount],
    );
    const hasMoreCompletedWeeks = visibleCompletedWeeksCount < completedGroups.length;

    const handleWorkoutPress = useCallback(
        (workoutId: string) => {
            router.navigate(`/workout/${workoutId}`);
        },
        [router],
    );
    const openMissed = useMissedSessionStore((state) => state.open);

    const handleEndReached = useCallback(() => {
        if (!hasMoreCompletedWeeks) {
            return;
        }

        setVisibleCompletedWeeksState((prev) => ({
            key: completedGroupsKey,
            count: Math.min(
                (prev.key === completedGroupsKey ? prev.count : COMPLETED_WEEKS_PAGE_SIZE) +
                    COMPLETED_WEEKS_PAGE_SIZE,
                completedGroups.length,
            ),
        }));
    }, [completedGroups.length, completedGroupsKey, hasMoreCompletedWeeks]);

    const listItems = useMemo<WorkoutsListItem[]>(() => {
        const items: WorkoutsListItem[] = [];

        inProgressWorkouts.forEach((workout, index) => {
            items.push({
                type: 'card',
                key: `in-progress-card-${workout.id}`,
                workout,
                section: 'in_progress',
                isFirstInSection: index === 0,
            });
        });

        if (missedWorkouts.length > 0) {
            items.push({
                type: 'day_header',
                key: 'missed-header',
                title: t('missed-session.missedGroup', { ns: 'screens' }),
                hasTopSpacing: items.length > 0,
            });

            missedWorkouts.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `missed-card-${workout.id}`,
                    workout,
                    section: 'missed',
                    isFirstInSection: index === 0,
                });
            });
        }

        // Planned sessions, a heading per day. `plannedWorkouts` arrives soonest
        // first, so a new day starts whenever the key changes.
        const today = dayjs();
        let currentKey: string | null = null;
        plannedWorkouts.forEach((workout) => {
            const key = dayKey(workout);
            const isFirstOfDay = key !== currentKey;

            if (isFirstOfDay) {
                currentKey = key;
                const day = dayjs(key);
                const title =
                    key === UNSCHEDULED
                        ? t('plan.unscheduled', { ns: 'screens' })
                        : day.isSame(today, 'day')
                          ? t('plan.today', { ns: 'screens' })
                          : day.isSame(today.add(1, 'day'), 'day')
                            ? t('plan.tomorrow', { ns: 'screens' })
                            : day.locale(i18n.language).format('ddd D MMM');
                const meals = mealSummaries[key];

                items.push({
                    type: 'day_header',
                    key: `day-${key}`,
                    title,
                    detail: meals
                        ? t('plan.meals', {
                              ns: 'screens',
                              count: meals.meals,
                              kcal: Math.round(meals.calories),
                          })
                        : undefined,
                    hasTopSpacing: items.length > 0,
                });
            }

            items.push({
                type: 'card',
                key: `planned-card-${workout.id}`,
                workout,
                section: 'planned',
                isFirstInSection: isFirstOfDay,
            });
        });

        visibleCompletedGroups.forEach((group) => {
            items.push({
                type: 'completed_header',
                key: `completed-header-${group.id}`,
                title: group.title,
                workoutsCount: group.workouts.length,
                hasTopSpacing: items.length > 0,
            });

            group.workouts.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `completed-card-${group.id}-${workout.id}`,
                    workout,
                    section: 'completed',
                    isFirstInSection: index === 0,
                });
            });
        });

        return items;
    }, [
        i18n.language,
        inProgressWorkouts,
        mealSummaries,
        missedWorkouts,
        plannedWorkouts,
        t,
        visibleCompletedGroups,
    ]);

    const renderItem = useCallback(
        ({ item }: { item: WorkoutsListItem }) => {
            if (item.type === 'day_header') {
                return (
                    <HStack style={styles.sectionHeaderContainer(item.hasTopSpacing)}>
                        <Text style={styles.sectionHeader} accessibilityRole="header">
                            {item.title}
                        </Text>
                        {item.detail ? (
                            <Text style={styles.sectionDetail} numberOfLines={1}>
                                {item.detail}
                            </Text>
                        ) : null}
                    </HStack>
                );
            }

            if (item.type === 'completed_header') {
                return (
                    <HStack style={styles.sectionHeaderContainer(item.hasTopSpacing)}>
                        <Text style={styles.sectionHeader} accessibilityRole="header">
                            {item.title}
                        </Text>
                        <Text style={styles.workoutsCount}>
                            {t('home.workoutsCount', {
                                ns: 'screens',
                                count: item.workoutsCount,
                            })}
                        </Text>
                    </HStack>
                );
            }

            const activeElapsedFormatted =
                item.section === 'in_progress' && item.workout.id === runningWorkout?.id
                    ? elapsedFormated
                    : null;

            return (
                <Box style={styles.cardContainer(item.isFirstInSection)}>
                    <WorkoutCard
                        workout={item.workout}
                        onPress={item.section === 'missed' ? openMissed : handleWorkoutPress}
                        activeElapsedFormatted={activeElapsedFormatted}
                        overviewMeta={workoutsOverviewMeta[item.workout.id]}
                        displayName={nameWithWeek(item.workout)}
                        bySyn={synWorkoutIds.has(item.workout.id)}
                    />
                </Box>
            );
        },
        [
            elapsedFormated,
            handleWorkoutPress,
            nameWithWeek,
            openMissed,
            runningWorkout?.id,
            synWorkoutIds,
            t,
            workoutsOverviewMeta,
        ],
    );

    return (
        <FlashList
            data={listItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.type}
            drawDistance={320}
            contentInsetAdjustmentBehavior="automatic"
            ListHeaderComponent={() => header}
            contentContainerStyle={styles.listContent}
            style={styles.listContainer}
            showsVerticalScrollIndicator={false}
            extraData={`${runningWorkout?.id || ''}:${elapsedFormated}`}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.15}
        />
    );
};
