import { FC, ReactNode, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { MenuPicker } from '@/components/forms/menu-picker';
import { useCaloriesStore } from '@/stores/calories';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { useWorkoutStats } from '@/hooks/use-workouts';
import { AwardTile } from '@/screens/awards/components/tile';
import { useAwards } from '@/screens/awards/data';

import { Bars, Line, Metric, Ring } from './charts';
import {
    ACCENT,
    PERIODS,
    useCaloriesSummary,
    useMovementSummary,
    useSessionsSummary,
    useWaterSummary,
    type Period,
} from '../summary';

/**
 * Today's cards. Each one keeps its own period (Today, This Week, This Month,
 * This Year), picked from the menu under its title the way Apple Fitness puts
 * "Today" there, and loads only its own figures for it.
 */

const RING_SIZE = 132;

const styles = StyleSheet.create((theme) => ({
    tile: {
        flex: 1,
        padding: theme.space(4),
        gap: theme.space(3),
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
    },
    head: {
        gap: theme.space(0.5),
    },
    titleRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    title: {
        flex: 1,
        fontSize: 19,
        lineHeight: 24,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    chevron: {
        height: 26,
        width: 26,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.neutral[700],
    },
    periodRow: {
        alignSelf: 'flex-start',
        marginLeft: -2,
    },
    caption: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    segments: {
        gap: theme.space(1.5),
    },
    segment: {
        gap: theme.space(1.5),
    },
    segmentBar: {
        height: 8,
        borderRadius: theme.radius.full,
    },
    segmentValue: (highlighted: boolean) => ({
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: highlighted ? theme.colors.typography : theme.colors.mutedTypography,
    }),
    target: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    stats: {
        gap: theme.space(3),
    },
    ring: {
        width: RING_SIZE,
        height: RING_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringLabel: {
        position: 'absolute',
        alignItems: 'center',
    },
    progress: {
        gap: theme.space(3),
    },
    progressFigure: {
        flex: 1,
    },
    awards: {
        marginHorizontal: -theme.space(1),
        marginBottom: -theme.space(4),
    },
}));

interface TileProps {
    title: string;
    /** Title colour, for the calorie card's two-tone heading. */
    accent?: string;
    period?: Period;
    onPeriod?: (period: Period) => void;
    onPress?: () => void;
    children: ReactNode;
}

/** A dark card: title and chevron, the period menu under it, then its figures. */
export const Tile: FC<TileProps> = ({ title, accent, period, onPeriod, onPress, children }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <Pressable
            style={styles.tile}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
        >
            <VStack style={styles.head}>
                <HStack style={styles.titleRow}>
                    <Text
                        style={[styles.title, accent ? { color: accent } : null]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {onPress ? (
                        <Box style={styles.chevron}>
                            <Icon
                                name="chevron-right"
                                size={12}
                                color={theme.colors.mutedTypography}
                            />
                        </Box>
                    ) : null}
                </HStack>
                {period && onPeriod ? (
                    <Box style={styles.periodRow}>
                        <MenuPicker
                            value={period}
                            options={PERIODS.map((value) => ({
                                value,
                                label: t(`metric.this.${value}`, { ns: 'screens' }),
                            }))}
                            onChange={onPeriod}
                            accessibilityLabel={t('home.dash.periodLabel', {
                                ns: 'screens',
                                title,
                            })}
                        />
                    </Box>
                ) : null}
            </VStack>
            {children}
        </Pressable>
    );
};

const openMetric = (kind: 'water' | 'distance', period: Period) =>
    router.navigate({ pathname: '/metric', params: { kind, period } } as never);

export const WaterCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const [period, setPeriod] = useState<Period>('today');
    const { water, current } = useWaterSummary(period, today);

    return (
        <Tile
            title={t('home.dash.water', { ns: 'screens' })}
            period={period}
            onPeriod={setPeriod}
            onPress={() => openMetric('water', period)}
        >
            <Bars data={water.series} current={current} color={ACCENT.water} />
            <Metric value={water.litres.toFixed(1)} unit="L" color={ACCENT.water} />
        </Tile>
    );
};

export const DistanceCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const [period, setPeriod] = useState<Period>('today');
    const { distance, distanceUnit, current } = useMovementSummary(period, today);

    // A running total, so the line climbs to the figure above it.
    const line = useMemo(() => {
        if (!distance) return [];
        let sum = 0;
        return [0, ...distance.series.slice(0, current + 1).map((value) => (sum += value))];
    }, [current, distance]);

    return (
        <Tile
            title={t('home.dash.distance', { ns: 'screens' })}
            period={period}
            onPeriod={setPeriod}
            onPress={() => openMetric('distance', period)}
        >
            <Metric
                value={distance ? distance.total.toFixed(2) : '–'}
                unit={distanceUnit}
                color={ACCENT.distance}
            />
            {distance ? (
                <Line data={line} color={ACCENT.distance} />
            ) : (
                <Text style={styles.caption}>{t('home.dash.noHealth', { ns: 'screens' })}</Text>
            )}
        </Tile>
    );
};

export const SessionsCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const [period, setPeriod] = useState<Period>('week');
    const sessions = useSessionsSummary(period, today);
    const total = sessions.done + sessions.planned + sessions.missed;
    const parts = [
        { key: 'done', value: sessions.done, highlighted: true },
        { key: 'planned', value: sessions.planned, highlighted: false },
        { key: 'missed', value: sessions.missed, highlighted: false },
    ];

    return (
        <Tile
            title={t('home.dash.sessions', { ns: 'screens' })}
            period={period}
            onPeriod={setPeriod}
            onPress={() => router.navigate('/sessions' as never)}
        >
            <HStack style={styles.segments}>
                {parts.map((part) => (
                    <VStack
                        key={part.key}
                        // Proportional, with a floor so an empty part still has its label.
                        style={[
                            styles.segment,
                            { flex: total ? Math.max(part.value / total, 0.2) : 1 },
                        ]}
                    >
                        <Box
                            style={[
                                styles.segmentBar,
                                {
                                    backgroundColor: ACCENT.sessions,
                                    opacity: part.highlighted ? 1 : 0.3,
                                },
                            ]}
                        />
                        <Text style={styles.segmentValue(part.highlighted)}>{part.value}</Text>
                        <Text style={styles.caption}>
                            {t(`home.dash.${part.key}`, { ns: 'screens' })}
                        </Text>
                    </VStack>
                ))}
            </HStack>
        </Tile>
    );
};

export const CaloriesCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const [period, setPeriod] = useState<Period>('today');
    const calories = useCaloriesSummary(period, today);
    const setCaloriesDay = useCaloriesStore((state) => state.setDay);

    return (
        <Tile
            title={t('home.dash.calorieTarget', { ns: 'screens' })}
            accent={ACCENT.calories}
            period={period}
            onPeriod={setPeriod}
            onPress={() => {
                setCaloriesDay(today);
                router.navigate('/calories' as never);
            }}
        >
            <HStack style={styles.target}>
                <VStack style={styles.stats}>
                    <VStack>
                        <Metric
                            value={String(calories.target)}
                            unit="kcal"
                            color={ACCENT.calories}
                            size={24}
                        />
                        <Text style={styles.caption}>
                            {t('home.dash.target', { ns: 'screens' })}
                        </Text>
                    </VStack>
                    <VStack>
                        <Metric
                            value={String(calories.remaining)}
                            unit="kcal"
                            color={ACCENT.calories}
                            size={24}
                        />
                        <Text style={styles.caption}>
                            {t('home.dash.remaining', { ns: 'screens' })}
                        </Text>
                    </VStack>
                </VStack>
                <Box style={styles.ring}>
                    <Ring
                        progress={calories.target > 0 ? calories.consumed / calories.target : 0}
                        color={ACCENT.calories}
                        size={RING_SIZE}
                    />
                    <VStack style={styles.ringLabel} pointerEvents="none">
                        <Metric
                            value={String(calories.consumed)}
                            color={ACCENT.calories}
                            size={28}
                        />
                        <Text style={styles.caption}>
                            {t('home.dash.consumed', { ns: 'screens' })}
                        </Text>
                    </VStack>
                </Box>
            </HStack>
        </Tile>
    );
};

export const AwardsCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const { goForIt, all } = useAwards(today);

    return (
        <Tile
            title={t('awards.title', { ns: 'screens' })}
            onPress={() => router.navigate('/awards' as never)}
        >
            <HStack style={styles.awards}>
                {(goForIt.length ? goForIt : all).slice(0, 3).map((award) => (
                    <AwardTile key={award.id} award={award} size={76} />
                ))}
            </HStack>
        </Tile>
    );
};

/** Progress, opened from Today now there is no tab bar: the week, the streak, all time. */
export const ProgressCard: FC = () => {
    const { t } = useTranslation(['screens']);
    const { done, target, streak } = useWeeklyStreak();
    const { workoutsCount } = useWorkoutStats();

    const figures = [
        {
            key: 'week',
            value: `${done}/${target}`,
            label: t('results.tiles.week', { ns: 'screens' }),
            color: ACCENT.sessions,
        },
        {
            key: 'streak',
            value: String(streak),
            label: t('results.hero.streak', { ns: 'screens' }),
            color: ACCENT.distance,
        },
        {
            key: 'workouts',
            value: workoutsCount ? String(workoutsCount) : '\u2013',
            label: t('results.stats.workoutsCount.title', { ns: 'screens' }),
            color: ACCENT.calories,
        },
    ];

    return (
        <Tile
            title={t('results.title', { ns: 'screens' })}
            onPress={() => router.navigate('/results' as never)}
        >
            <HStack style={styles.progress}>
                {figures.map((figure) => (
                    <VStack key={figure.key} style={styles.progressFigure}>
                        <Metric value={figure.value} color={figure.color} size={28} />
                        <Text style={styles.caption} numberOfLines={1}>
                            {figure.label}
                        </Text>
                    </VStack>
                ))}
            </HStack>
        </Tile>
    );
};
