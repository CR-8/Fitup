import { FC } from 'react';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
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
import { useStepsGoalStore } from '@/stores/steps-goal';

import { Rings } from '../charts';
import { ACCENT, useMovementSummary } from '../../summary';

/**
 * Today's dial: water drunk, steps taken and the week's sessions, one ring
 * each (outer to inner), with the three figures beside it and a way into each.
 * The rings are left clear, Apple's way: the figures beside them say it, and
 * text inside spilled over the inner ring. Tapping them opens the activity
 * screen (`screens/activity`).
 */

const STROKE = 12;
const GAP = 5;

const styles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
        padding: theme.space(4),
        gap: theme.space(3),
    },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    body: {
        alignItems: 'center',
        gap: theme.space(3),
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
    prompt: (color: string) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color,
    }),
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
    prompt?: string;
    onPress: () => void;
}

export const RingsCard: FC<{ today: string }> = ({ today }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { width } = useWindowDimensions();
    const water = useWaterDay(today);
    const { steps, access, connect } = useMovementSummary('today', today);
    const canConnect = access === 'ask' || access === 'install';
    const week = useWeeklyStreak();
    const stepsGoal = useStepsGoalStore((state) => state.goal);

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
            key: 'steps',
            label: t('activity.steps', { ns: 'screens' }),
            icon: 'run',
            color: ACCENT.distance,
            value: steps ? Math.round(steps.total).toLocaleString(i18n.language) : '–',
            goal: stepsGoal.toLocaleString(i18n.language),
            progress: steps ? steps.total / stepsGoal : 0,
            // Until Health is connected the row asks for it, in place of the goal.
            prompt: canConnect
                ? t(access === 'install' ? 'health.install' : 'health.connect', {
                      ns: 'screens',
                  })
                : undefined,
            onPress: canConnect
                ? connect
                : () =>
                      router.navigate({
                          pathname: '/metric',
                          params: { kind: 'steps', period: 'today' },
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
    const openActivity = () => router.navigate('/activity' as never);

    // As wide as half the card's inside allows, so the three figures keep the rest.
    const size = Math.min(176, Math.round((width - theme.space(16)) * 0.5));

    return (
        <VStack style={styles.card}>
            <Pressable
                onPress={openActivity}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('home.rings.open', { ns: 'screens' })}
            >
                <HStack style={styles.header}>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('home.rings.title', { ns: 'screens' })}
                    </Text>
                    <Icon name="arrow-right" size={18} color={theme.colors.mutedTypography} />
                </HStack>
            </Pressable>

            <HStack style={styles.body}>
                <Pressable
                    onPress={openActivity}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('home.rings.open', { ns: 'screens' })}: ${rings
                        .map(
                            (ring) =>
                                `${ring.label} ${ring.value} / ${ring.goal} ${ring.unit ?? ''}`,
                        )
                        .join(', ')}`}
                >
                    <Rings rings={rings} size={size} stroke={STROKE} gap={GAP} />
                </Pressable>

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
                                        <Text
                                            style={
                                                ring.prompt ? styles.prompt(ring.color) : styles.of
                                            }
                                            numberOfLines={1}
                                        >
                                            {ring.prompt
                                                ? ` ${ring.prompt}`
                                                : ` / ${ring.goal}${ring.unit ? ` ${ring.unit}` : ''}`}
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
            </HStack>
        </VStack>
    );
};
