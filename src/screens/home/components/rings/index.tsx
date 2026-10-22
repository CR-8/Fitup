import { FC } from 'react';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { useWaterDay } from '@/hooks/use-water';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';

import { ACCENT, useMovementSummary } from '../../summary';

/**
 * Today's dial: water drunk, distance covered and the week's sessions, one ring
 * each (outer to inner), with the three figures beside it and a way into each.
 * The centre counts the sessions, the one goal the week is built around.
 */

const STROKE = 12;
const GAP = 5;

// ponytail: one fixed daily distance goal; make it a setting if people ask to change it.
const DISTANCE_GOAL = { km: 5, mi: 3 };

const styles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
        padding: theme.space(4),
        paddingTop: theme.space(5),
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
    },
    open: {
        position: 'absolute',
        top: theme.space(3),
        right: theme.space(3),
        zIndex: 1,
    },
    center: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerLabel: {
        ...theme.fontSize.xs,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    centerValue: {
        fontSize: 30,
        lineHeight: 36,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    rows: {
        flex: 1,
        gap: theme.space(4),
    },
    row: {
        alignItems: 'center',
        gap: theme.space(2.5),
    },
    glyph: (color: string) => ({
        height: 36,
        width: 36,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    text: {
        flex: 1,
    },
    label: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
    },
    figure: {
        alignItems: 'baseline',
    },
    value: (color: string) => ({
        fontSize: 22,
        lineHeight: 28,
        color,
        ...theme.typography.metric,
    }),
    of: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

/** "1.5", "2", "0.25": a figure without trailing zeros. */
const trim = (value: number, digits = 1) => String(Number(value.toFixed(digits)));

interface Ring {
    key: string;
    label: string;
    icon: IconName;
    color: string;
    value: string;
    goal: string;
    unit?: string;
    progress: number;
    onPress: () => void;
}

export const RingsCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { width } = useWindowDimensions();
    const water = useWaterDay(today);
    const { distance, distanceUnit } = useMovementSummary('today', today);
    const week = useWeeklyStreak();

    const distanceGoal = DISTANCE_GOAL[distanceUnit === 'mi' ? 'mi' : 'km'];
    const rings: Ring[] = [
        {
            key: 'water',
            label: t('home.dash.water', { ns: 'screens' }),
            icon: 'droplet',
            color: ACCENT.water,
            value: trim(water.totalMl / 1000),
            goal: trim(water.targetMl / 1000),
            unit: 'L',
            progress: water.progress,
            onPress: () => router.navigate('/hydration' as never),
        },
        {
            key: 'distance',
            label: t('home.dash.distance', { ns: 'screens' }),
            icon: 'run',
            color: ACCENT.distance,
            value: distance ? trim(distance.total) : '–',
            goal: String(distanceGoal),
            unit: distanceUnit,
            progress: distance ? distance.total / distanceGoal : 0,
            onPress: () =>
                router.navigate({
                    pathname: '/metric',
                    params: { kind: 'distance', period: 'today' },
                } as never),
        },
        {
            key: 'sessions',
            label: t('home.dash.sessions', { ns: 'screens' }),
            icon: 'dumbbell',
            color: ACCENT.sessions,
            value: String(week.done),
            goal: String(week.target),
            progress: week.target > 0 ? week.done / week.target : 0,
            onPress: () => router.navigate('/sessions' as never),
        },
    ];

    // As wide as half the card's inside allows, so the three figures keep the rest.
    const size = Math.min(176, Math.round((width - theme.space(16)) * 0.5));

    return (
        <Box
            style={styles.card}
            accessibilityLabel={rings
                .map((ring) => `${ring.label} ${ring.value} / ${ring.goal} ${ring.unit ?? ''}`)
                .join(', ')}
        >
            <Pressable
                style={styles.open}
                hitSlop={10}
                onPress={() =>
                    router.navigate({ pathname: '/day', params: { date: today } } as never)
                }
                accessibilityRole="button"
                accessibilityLabel={t('home.rings.open', { ns: 'screens' })}
            >
                <Icon name="arrow-right" size={18} color={theme.colors.mutedTypography} />
            </Pressable>

            <Box style={{ width: size, height: size }}>
                <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                    {rings.map((ring, i) => {
                        const radius = (size - STROKE) / 2 - i * (STROKE + GAP);
                        const circumference = 2 * Math.PI * radius;
                        const filled = Math.min(Math.max(ring.progress, 0), 1);

                        return (
                            <G key={ring.key}>
                                <Circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    stroke={theme.colors.neutral[700]}
                                    strokeWidth={STROKE}
                                    fill="none"
                                />
                                {filled > 0 ? (
                                    <Circle
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        stroke={ring.color}
                                        strokeWidth={STROKE}
                                        strokeDasharray={`${circumference} ${circumference}`}
                                        strokeDashoffset={circumference * (1 - filled)}
                                        strokeLinecap="round"
                                        fill="none"
                                    />
                                ) : null}
                            </G>
                        );
                    })}
                </Svg>
                <VStack style={styles.center} pointerEvents="none">
                    <Text style={styles.centerLabel}>
                        {t('home.rings.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.centerValue}>
                        {week.done}/{week.target}
                    </Text>
                    <Text style={styles.centerLabel}>
                        {t('home.rings.sessions', { ns: 'screens' })}
                    </Text>
                </VStack>
            </Box>

            <VStack style={styles.rows}>
                {rings.map((ring) => (
                    <Pressable
                        key={ring.key}
                        onPress={ring.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={`${ring.label}, ${ring.value} / ${ring.goal} ${ring.unit ?? ''}`}
                    >
                        <HStack style={styles.row}>
                            <Box style={styles.glyph(ring.color)}>
                                <Icon name={ring.icon} size={17} color={ring.color} />
                            </Box>
                            <VStack style={styles.text}>
                                <Text style={styles.label} numberOfLines={1}>
                                    {ring.label}
                                </Text>
                                <HStack style={styles.figure}>
                                    <Text style={styles.value(ring.color)}>{ring.value}</Text>
                                    <Text style={styles.of} numberOfLines={1}>
                                        {` / ${ring.goal}${ring.unit ? ` ${ring.unit}` : ''}`}
                                    </Text>
                                </HStack>
                            </VStack>
                            <Icon
                                name="chevron-right"
                                size={14}
                                color={theme.colors.mutedTypography}
                            />
                        </HStack>
                    </Pressable>
                ))}
            </VStack>
        </Box>
    );
};
