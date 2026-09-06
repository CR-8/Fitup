import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { WorkoutSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { WorkoutGroup } from '@/helpers/workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import type { WorkoutOverviewMetaMap } from '@/hooks/use-workouts';

import { WorkoutCard } from '../workout-card';
import { type UpNextState } from '../up-next';

type WorkoutSectionType = 'in_progress' | 'planned' | 'completed';

type CardItem = {
    type: 'card';
    key: string;
    workout: WorkoutSelect;
    section: WorkoutSectionType;
    isFirstInSection: boolean;
};

type PlannedHeaderItem = {
    type: 'planned_header';
    key: string;
    title: string;
    hasTopSpacing: boolean;
};

type CompletedHeaderItem = {
    type: 'completed_header';
    key: string;
    title: string;
    workoutsCount: number;
    hasTopSpacing: boolean;
};

type WorkoutsListItem = CardItem | PlannedHeaderItem | CompletedHeaderItem;

const COMPLETED_WEEKS_PAGE_SIZE = 5;

interface WorkoutsProps {
    inProgressWorkouts: WorkoutSelect[];
    plannedWorkouts: WorkoutSelect[];
    completedGroups: WorkoutGroup[];
    workoutsOverviewMeta: WorkoutOverviewMetaMap;
    upNext: UpNextState;
    /** What sits above the list. Supplied by the screen that owns it. */
    header: ReactNode;
}

const styles = StyleSheet.create((theme) => ({
    listContainer: {
        flex: 1,
    },
    listContent: {
        // No `paddingBottom` override here. `screenContentPadding('root')`
        // already reserves `insets.bottom + space(20)`, which is what clears the
        // tab bar — replacing it with `space(4)` left the last card sitting
        // underneath it, unreachable however far you scrolled.
        ...theme.screenContentPadding('root'),
    },
    headerContent: {
        gap: theme.space(5),
        paddingBottom: theme.space(5),
    },
    sectionHeaderContainer: (hasTopSpacing: boolean) => ({
        paddingHorizontal: theme.space(4),
        marginTop: hasTopSpacing ? theme.space(6) : 0,
    }),
    sectionHeader: {
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    completedHeaderContainer: (hasTopSpacing: boolean) => ({
        marginTop: hasTopSpacing ? theme.space(6) : 0,
        gap: theme.space(3),
    }),
    workoutsStatsContainer: {
        paddingHorizontal: theme.space(4),
    },
    workoutsCountContainer: {
        backgroundColor: theme.colors.foreground,
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.full,
    },
    workoutsCount: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    cardContainer: (isFirstInSection: boolean, section: WorkoutSectionType) => ({
        paddingHorizontal: theme.space(4),
        marginTop: isFirstInSection
            ? section === 'in_progress'
                ? 0
                : theme.space(3)
            : theme.space(2),
    }),
}));

export const Workouts: FC<WorkoutsProps> = ({
    inProgressWorkouts,
    plannedWorkouts,
    completedGroups,
    workoutsOverviewMeta,
    upNext,
    header,
}) => {
    const { t } = useTranslation(['screens']);
    const router = useRouter();
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();
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

        // Whatever the card above is offering is not repeated here. Without
        // this the running workout renders twice — once as the hero and once as
        // the first row beneath it.
        const promotedId = upNext.kind === 'create' ? null : upNext.workout.id;

        const remainingInProgress = inProgressWorkouts.filter(
            (workout) => workout.id !== promotedId,
        );
        const remainingPlanned = plannedWorkouts.filter((workout) => workout.id !== promotedId);

        if (remainingInProgress.length > 0) {
            remainingInProgress.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `in-progress-card-${workout.id}`,
                    workout,
                    section: 'in_progress',
                    isFirstInSection: index === 0,
                });
            });
        }

        if (remainingPlanned.length > 0) {
            items.push({
                type: 'planned_header',
                key: 'planned-header',
                title: t('home.planned', { ns: 'screens' }),
                hasTopSpacing: items.length > 0,
            });

            remainingPlanned.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `planned-card-${workout.id}`,
                    workout,
                    section: 'planned',
                    isFirstInSection: index === 0,
                });
            });
        }

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
    }, [inProgressWorkouts, plannedWorkouts, upNext, visibleCompletedGroups, t]);

    const renderItem = useCallback(
        ({ item }: { item: WorkoutsListItem }) => {
            if (item.type === 'planned_header') {
                return (
                    <Box style={styles.sectionHeaderContainer(item.hasTopSpacing)}>
                        <Text style={styles.sectionHeader}>{item.title}</Text>
                    </Box>
                );
            }

            if (item.type === 'completed_header') {
                return (
                    <VStack style={styles.completedHeaderContainer(item.hasTopSpacing)}>
                        <Box style={styles.sectionHeaderContainer(false)}>
                            <Text style={styles.sectionHeader}>{item.title}</Text>
                        </Box>
                        <HStack style={styles.workoutsStatsContainer}>
                            <Box style={styles.workoutsCountContainer}>
                                <Text style={styles.workoutsCount}>
                                    {t('home.workoutsCount', {
                                        ns: 'screens',
                                        count: item.workoutsCount,
                                    })}
                                </Text>
                            </Box>
                        </HStack>
                    </VStack>
                );
            }

            const activeElapsedFormatted =
                item.section === 'in_progress' && item.workout.id === runningWorkout?.id
                    ? elapsedFormated
                    : null;

            return (
                <Box style={styles.cardContainer(item.isFirstInSection, item.section)}>
                    <WorkoutCard
                        workout={item.workout}
                        onPress={handleWorkoutPress}
                        activeElapsedFormatted={activeElapsedFormatted}
                        overviewMeta={workoutsOverviewMeta[item.workout.id]}
                    />
                </Box>
            );
        },
        [elapsedFormated, handleWorkoutPress, runningWorkout?.id, t, workoutsOverviewMeta],
    );

    return (
        <FlashList
            data={listItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.type}
            drawDistance={320}
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
