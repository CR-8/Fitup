import { FC, ReactNode, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { MenuPicker } from '@/components/forms/menu-picker';
import { Medal } from '@/screens/awards/components/badge';
import { openAward } from '@/screens/awards/components/tile';
import { useAwardText, useAwards, type Award } from '@/screens/awards/data';

import { Bars, Line, Metric, Ring } from './charts';
import {
    ACCENT,
    PERIODS,
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
    intro: {
        flex: 0,
        gap: theme.space(3),
    },
    introRow: {
        alignItems: 'flex-start',
        gap: theme.space(3),
    },
    introText: {
        flex: 1,
        gap: theme.space(1),
    },
    introTitle: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    introDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    introLink: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: ACCENT.distance,
    },
    viewAll: {
        alignItems: 'center',
        gap: 2,
    },
    viewAllText: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    medals: {
        justifyContent: 'space-around',
    },
    medal: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    medalName: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
        marginTop: theme.space(1),
    },
    medalCaption: {
        ...theme.fontSize.xs,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
}));

interface TileProps {
    title: string;
    period?: Period;
    onPeriod?: (period: Period) => void;
    onPress?: () => void;
    children: ReactNode;
}

/** A dark card: title and chevron, the period menu under it, then its figures. */
export const Tile: FC<TileProps> = ({ title, period, onPeriod, onPress, children }) => {
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
                    <Text style={styles.title} numberOfLines={1}>
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

/** The two awards earned last, then the closest to earn: Today's shelf, each opening its award. */
export const AwardsCard: FC<{ today: string }> = ({ today }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const text = useAwardText();
    const { all, goForIt } = useAwards(today);

    const shelf = useMemo(() => {
        const won = (award: Award) => award.earned || !!award.lastEarnedAt;
        // An award met today but not yet recorded counts as earned now.
        const at = (award: Award) => award.lastEarnedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const earned = all
            .filter(won)
            .sort((a, b) => at(b) - at(a))
            .slice(0, 2);
        const next = goForIt.filter((award) => !earned.includes(award));

        return [...earned, ...next].slice(0, 3).map((award) => ({ award, earned: won(award) }));
    }, [all, goForIt]);

    if (!shelf.length) return null;

    return (
        <VStack style={styles.tile}>
            <HStack style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                    {t('awards.title', { ns: 'screens' })}
                </Text>
                <Pressable
                    onPress={() => router.navigate('/awards' as never)}
                    hitSlop={10}
                    accessibilityRole="button"
                >
                    <HStack style={styles.viewAll}>
                        <Text style={styles.viewAllText}>
                            {t('awards.viewAll', { ns: 'screens' })}
                        </Text>
                        <Icon name="chevron-right" size={14} color={theme.colors.mutedTypography} />
                    </HStack>
                </Pressable>
            </HStack>
            <HStack style={styles.medals}>
                {shelf.map(({ award, earned }) => (
                    <Pressable
                        key={award.id}
                        style={styles.medal}
                        onPress={() => openAward(award)}
                        accessibilityRole="button"
                        accessibilityLabel={`${text.name(award)}, ${text.detail(award)}`}
                    >
                        <Medal {...award} earned={earned} size={88} />
                        <Text style={styles.medalName} numberOfLines={1}>
                            {text.name(award)}
                        </Text>
                        <Text style={styles.medalCaption} numberOfLines={1}>
                            {earned
                                ? dayjs(award.lastEarnedAt ?? undefined)
                                      .locale(i18n.language)
                                      .format('D MMM YYYY')
                                : text.detail(award)}
                        </Text>
                    </Pressable>
                ))}
            </HStack>
        </VStack>
    );
};

/** "A Customizable Summary", Apple Fitness's intro: what the Summary can be, and the way to edit it. */
export const SummaryIntro: FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <VStack style={[styles.tile, styles.intro]}>
            <HStack style={styles.introRow}>
                <Ring progress={0.66} color={ACCENT.distance} size={40} />
                <VStack style={styles.introText}>
                    <Text style={styles.introTitle}>
                        {t('home.dash.intro.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.caption}>
                        {t('home.dash.intro.body', { ns: 'screens' })}
                    </Text>
                </VStack>
                <Pressable
                    onPress={onDismiss}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.dash.intro.dismiss', { ns: 'screens' })}
                >
                    <Icon name="x" size={16} color={theme.colors.mutedTypography} />
                </Pressable>
            </HStack>
            <Box style={styles.introDivider} />
            <Pressable
                onPress={() => router.navigate('/summary-edit' as never)}
                accessibilityRole="button"
            >
                <Text style={styles.introLink}>{t('home.dash.intro.edit', { ns: 'screens' })}</Text>
            </Pressable>
        </VStack>
    );
};
