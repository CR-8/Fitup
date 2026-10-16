import { FC, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { Title } from '@/components/typography/title';
import { useWorkoutsOverviewMeta, useWorkouts } from '@/hooks/use-workouts';
import { getPlanWeekByWorkoutId } from '@/helpers/ai-plan';
import { useAppliedPlans } from '@/hooks/use-ai';

/**
 * The session's hero, full-bleed as the reference's workout page: photograph,
 * the name set over it, and what is in it. Placeholder imagery until the team
 * supplies licensed photos; swap the file, not the code.
 */
const PLACEHOLDER_PHOTO = require('../../../../../../assets/images/placeholders/hero-gym.jpg');

const styles = StyleSheet.create((theme) => ({
    container: {
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    fill: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    content: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(36),
        paddingBottom: theme.space(5),
        gap: theme.space(2),
    },
    // Always light: it sits on a photograph under a dark scrim, in either theme.
    title: {
        color: theme.colors.white,
    },
    muscles: {
        ...theme.fontSize.sm,
        color: theme.colors.neutral[300],
    },
    metaRow: {
        alignItems: 'center',
        gap: theme.space(4),
    },
    metaItem: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    meta: {
        ...theme.fontSize.sm,
        color: theme.colors.neutral[300],
    },
}));

/** Roughly nine minutes an exercise, rounded to five: sets and rest are not loaded here. */
const estimateMinutes = (exercisesCount: number): number =>
    Math.max(5, Math.round((exercisesCount * 9) / 5) * 5);

export const SessionHero: FC<{ workoutId: string; name: string }> = ({ workoutId, name }) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();
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
            <Image
                source={PLACEHOLDER_PHOTO}
                style={styles.fill}
                contentFit="cover"
                accessibilityIgnoresInvertColors
            />
            <LinearGradient
                colors={['rgba(8, 9, 11, 0)', 'rgba(8, 9, 11, 0.55)', 'rgba(8, 9, 11, 1)']}
                locations={[0, 0.55, 1]}
                style={styles.fill}
            />
            <VStack style={styles.content}>
                <Title type="h1" style={styles.title} accessibilityRole="header">
                    {displayName}
                </Title>
                {muscles ? <Text style={styles.muscles}>{muscles}</Text> : null}
                {count > 0 ? (
                    <HStack style={styles.metaRow}>
                        <HStack style={styles.metaItem}>
                            <Icon
                                name="dumbbell"
                                size={theme.space(4)}
                                color={theme.colors.neutral[300]}
                            />
                            <Text style={styles.meta}>
                                {t('home.upNext.exerciseCount', { ns: 'screens', count })}
                            </Text>
                        </HStack>
                        <HStack style={styles.metaItem}>
                            <Icon
                                name="clock"
                                size={theme.space(4)}
                                color={theme.colors.neutral[300]}
                            />
                            <Text style={styles.meta}>
                                {t('home.upNext.minutes', {
                                    ns: 'screens',
                                    count: estimateMinutes(count),
                                })}
                            </Text>
                        </HStack>
                    </HStack>
                ) : null}
            </VStack>
        </VStack>
    );
};
