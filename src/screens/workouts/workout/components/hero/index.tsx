import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { Title } from '@/components/typography/title';
import { useWorkoutsOverviewMeta, useWorkouts } from '@/hooks/use-workouts';
import { getPlanWeekByWorkoutId } from '@/helpers/ai-plan';
import { useAppliedPlans } from '@/hooks/use-ai';
import { Metric } from '@/screens/home/components/charts';
import { ACCENT } from '@/screens/home/summary';
import { SESSION_COLORS } from '@/screens/sessions/components/list/types';

/**
 * The session's header in the Summary's language: its icon tile and name, the
 * muscles it works, and its size in rounded figures (exercises, estimated
 * minutes), the way Today's Workout card shows it.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(4),
        paddingBottom: theme.space(5),
        gap: theme.space(4),
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    icon: {
        height: 56,
        width: 56,
        borderRadius: 16,
        borderCurve: 'continuous' as const,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${ACCENT.distance}26`,
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    muscles: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    figures: {
        gap: theme.space(8),
    },
    label: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
}));

/** Roughly nine minutes an exercise, rounded to five: sets and rest are not loaded here. */
const estimateMinutes = (exercisesCount: number): number =>
    Math.max(5, Math.round((exercisesCount * 9) / 5) * 5);

export const SessionHero: FC<{ workoutId: string; name: string }> = ({ workoutId, name }) => {
    const { t } = useTranslation(['common', 'screens']);
    const { data: meta } = useWorkoutsOverviewMeta([workoutId]);
    const { data: workouts } = useWorkouts();
    const { plans } = useAppliedPlans();

    const week = useMemo(
        () => getPlanWeekByWorkoutId(plans, workouts ?? []).get(workoutId),
        [plans, workoutId, workouts],
    );
    const displayName = week ? t('home.sessionWithWeek', { ns: 'screens', name, week }) : name;

    const overview = meta?.[workoutId];
    const muscles = (overview?.sortedPrimaryMuscleGroups ?? [])
        .slice(0, 3)
        .map((muscle) => t(`muscleGroup.${muscle}`, { ns: 'common', defaultValue: muscle }))
        .join(' · ');
    const count = overview?.exercisesCount ?? 0;

    return (
        <VStack style={styles.container}>
            <HStack style={styles.row}>
                <Box style={styles.icon}>
                    <Icon name="dumbbell" size={26} color={ACCENT.distance} />
                </Box>
                <VStack style={styles.text}>
                    <Title type="h1" accessibilityRole="header" numberOfLines={2}>
                        {displayName}
                    </Title>
                    {muscles ? <Text style={styles.muscles}>{muscles}</Text> : null}
                </VStack>
            </HStack>
            {count > 0 ? (
                <HStack style={styles.figures}>
                    <VStack>
                        <Metric value={String(count)} color={ACCENT.distance} size={30} />
                        <Text style={styles.label}>
                            {t('home.upNext.exercisesLabel', { ns: 'screens', count })}
                        </Text>
                    </VStack>
                    <VStack>
                        <Metric
                            value={String(estimateMinutes(count))}
                            unit="min"
                            color={SESSION_COLORS.time}
                            size={30}
                        />
                        <Text style={styles.label}>
                            {t('home.upNext.estimate', { ns: 'screens' })}
                        </Text>
                    </VStack>
                </HStack>
            ) : null}
        </VStack>
    );
};
