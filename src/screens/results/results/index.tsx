import { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Title } from '@/components/typography/title';
import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { MetricTiles, type MetricTile } from '@/components/layout/metric-tiles';
import { useWorkoutStats } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { resolveFitnessLevel } from '@/helpers/fitness-level';
import { ACCENT } from '@/screens/home/summary';
import { SESSION_COLORS } from '@/screens/sessions/components/list/types';

import { ActivitySummary } from './components/activity-summary';
import { PersonalBests } from './components/personal-bests';
import { SessionsPerWeek } from './components/sessions-per-week';
import { LongSessionNotice } from './components/long-session-notice';
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
        borderRadius: 22,
        borderCurve: 'continuous' as const,
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
    const { streak, done: weekDone, target: weekTarget } = useWeeklyStreak();

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

    // The reference summary's grid: four figures, each in its own colour,
    // each a real count or an em dash.
    const tiles: MetricTile[] = [
        {
            key: 'week',
            title: t('results.tiles.week', { ns: 'screens' }),
            caption: t('results.tiles.thisWeek', { ns: 'screens' }),
            value: `${weekDone}/${weekTarget}`,
            color: ACCENT.sessions,
        },
        {
            key: 'streak',
            title: t('results.hero.streak', { ns: 'screens' }),
            caption: t('results.tiles.weeksInRow', { ns: 'screens' }),
            value: String(streak),
            color: ACCENT.distance,
        },
        {
            key: 'workouts',
            title: t('results.stats.workoutsCount.title', { ns: 'screens' }),
            caption: t('results.tiles.allTime', { ns: 'screens' }),
            value: stats.workoutsCount
                ? t('number', { value: stats.workoutsCount, ns: 'common' })
                : '—',
            color: ACCENT.calories,
        },
        {
            key: 'time',
            title: t('results.stats.trainingHours.title', { ns: 'screens' }),
            caption: t('results.tiles.allTime', { ns: 'screens' }),
            value: stats.trainingHours ? String(stats.trainingHours) : '—',
            unit: stats.trainingHours ? t('results.tiles.hoursUnit', { ns: 'screens' }) : undefined,
            color: SESSION_COLORS.time,
        },
    ];

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
            {/* iOS shows this in the native large title. */}
            {Platform.OS === 'android' && (
                <Title type="h1">{t('results.title', { ns: 'screens' })}</Title>
            )}
            <LongSessionNotice />
            <MetricTiles tiles={tiles} />
            {/* The design board's reading order: totals, the month's training
                time, then muscular load — before the calendar and the rest. */}
            <ActivitySummary onScrubbingChange={setIsChartScrubbing} />
            <SessionsPerWeek />
            <PersonalBests />
            <StrengthStats />
            <MonthStats />
            <FitnessLevelCard level={fitnessLevel} />
            <Scale />
            <VStack style={styles.fieldContainer}>
                <Title type="h4" accessibilityRole="header">
                    {t('results.stats.title', { ns: 'screens' })}
                </Title>
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
