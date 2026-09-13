import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Title } from '@/components/typography/title';
import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { StatBlocks, type StatBlock } from '@/components/layout/stat-blocks';
import { useWorkoutStats, useWorkouts } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { computeStreakDays } from '@/helpers/workouts';
import { resolveFitnessLevel } from '@/helpers/fitness-level';

import { ActivitySummary } from './components/activity-summary';
import { FitnessLevelCard } from './components/fitness-level';
import { MonthStats } from './components/month';
import { Scale } from './components/scale';
import { StrengthStats } from './components/strength';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(5),
    },
    statsContainer: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
    },
    statsWrapper: {
        flex: 1,
    },
    statContainer: {
        height: theme.space(8),
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    statTitleContainer: {
        gap: theme.space(2),
    },
    // Label and value were the same style, which is why a row of figures read
    // as two columns of identical text rather than a caption and its number.
    statLabel: {
        color: theme.colors.mutedTypography,
    },
    statValue: {
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        ...theme.typography.metric,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginVertical: theme.space(2),
    },
    fieldContainer: {
        gap: theme.space(3),
    },
}));

const ResultsScreen = () => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();
    const stats = useWorkoutStats();
    const [isChartScrubbing, setIsChartScrubbing] = useState(false);

    // `MonthStats` below already runs this query, so the streak rides along on
    // a cache hit rather than a second fetch.
    const { data: workouts } = useWorkouts();

    /**
     * The three figures worth reading from across a room, promoted out of the
     * eight-row list further down.
     *
     * Every one of them is a real total or `—`. `useWorkoutStats` returns null
     * for a metric it cannot compute, and that is shown as an em dash rather
     * than as a zero that would read as a fact about the user's training.
     */
    /**
     * Same threshold `buildProfileContext` (src/crud/ai/index.ts) uses before
     * calling `resolveFitnessLevel` — a level is only ever computed once there
     * is a nonzero workout count and training-week span to compute it from.
     */
    const fitnessLevel = useMemo(
        () =>
            stats.workoutsCount && stats.trainingWeeks
                ? resolveFitnessLevel({
                      workoutsCount: stats.workoutsCount,
                      trainingWeeks: stats.trainingWeeks,
                  })
                : null,
        [stats.trainingWeeks, stats.workoutsCount],
    );

    const heroBlocks = useMemo<StatBlock[]>(() => {
        const streak = computeStreakDays(workouts ?? []);

        return [
            {
                key: 'workouts',
                value: stats.workoutsCount
                    ? t('number', { value: stats.workoutsCount, ns: 'common' })
                    : '—',
                label: t('results.stats.workoutsCount.title', { ns: 'screens' }),
                emphasised: true,
            },
            {
                key: 'time',
                value: stats.trainingHours
                    ? t('results.hero.hours', { ns: 'screens', value: stats.trainingHours })
                    : '—',
                label: t('results.stats.trainingHours.title', { ns: 'screens' }),
            },
            {
                key: 'streak',
                value: streak > 0 ? String(streak) : '—',
                label: t('results.hero.streak', { ns: 'screens' }),
                emphasised: streak >= 2,
            },
        ];
    }, [stats.trainingHours, stats.workoutsCount, t, workouts]);

    // `workoutsCount` and `trainingHours` are already the hero blocks above —
    // repeating them here was the same two figures shown twice on one screen.
    const statsData = useMemo(() => {
        return [
            {
                title: t('results.stats.trainingWeeks.title', { ns: 'screens' }),
                value: stats.trainingWeeks
                    ? t('number', { value: stats.trainingWeeks, ns: 'common' })
                    : '-',
            },
            {
                title: t('results.stats.trainingDays.title', { ns: 'screens' }),
                value: stats.trainingDays
                    ? t('number', { value: stats.trainingDays, ns: 'common' })
                    : '-',
            },
            {
                title: t('results.stats.volume.title', { ns: 'screens' }),
                value: stats.volume
                    ? t('weight.weight', {
                          value: stats.volume,
                          context: user?.weightUnits ?? undefined,
                          ns: 'common',
                      })
                    : '-',
            },
            {
                title: t('results.stats.exercisesCount.title', { ns: 'screens' }),
                value: stats.exercisesCount
                    ? t('number', { value: stats.exercisesCount, ns: 'common' })
                    : '-',
            },
            {
                title: t('results.stats.setsCount.title', { ns: 'screens' }),
                value: stats.setsCount
                    ? t('number', { value: stats.setsCount, ns: 'common' })
                    : '-',
            },
            {
                title: t('results.stats.repsCount.title', { ns: 'screens' }),
                value: stats.repsCount
                    ? t('number', { value: stats.repsCount, ns: 'common' })
                    : '-',
            },
        ];
    }, [stats, user?.weightUnits, t]);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            scrollEnabled={!isChartScrubbing}
        >
            <Title type="h1">{t('results.title', { ns: 'screens' })}</Title>
            <StatBlocks blocks={heroBlocks} inset={false} />
            <FitnessLevelCard level={fitnessLevel} />
            <MonthStats />
            <ActivitySummary onScrubbingChange={setIsChartScrubbing} />
            <StrengthStats />
            <Scale />
            <VStack style={styles.fieldContainer}>
                <Title type="h4">{t('results.stats.title', { ns: 'screens' })}</Title>
                <VStack style={styles.statsContainer}>
                    <VStack style={styles.statsWrapper}>
                        {statsData.map((stat, index) => (
                            <VStack key={index}>
                                <HStack style={styles.statContainer}>
                                    <VStack style={styles.statTitleContainer}>
                                        <Box>
                                            <Text style={styles.statLabel}>{stat.title}</Text>
                                        </Box>
                                    </VStack>
                                    <Box>
                                        <Text style={styles.statValue}>{stat.value}</Text>
                                    </Box>
                                </HStack>
                                {index < statsData.length - 1 && <Box style={styles.divider} />}
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            </VStack>
        </ScrollView>
    );
};

export default ResultsScreen;
