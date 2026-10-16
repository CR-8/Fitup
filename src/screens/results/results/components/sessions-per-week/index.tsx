import { FC, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { BarChart } from 'react-native-gifted-charts';
import dayjs from 'dayjs';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { useUser } from '@/hooks/use-user';
import { useWorkouts } from '@/hooks/use-workouts';

const WEEKS = 8;
const CHART_HEIGHT = 140;
const EDGE = 6;
const Y_AXIS_AREA = 28;

const styles = StyleSheet.create((theme) => ({
    section: {
        gap: theme.space(3),
    },
    title: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.solid.typography,
    },
    card: {
        backgroundColor: theme.solid.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        padding: theme.space(4),
        gap: theme.space(3),
    },
    headline: {
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    value: {
        fontSize: 32,
        lineHeight: 36,
        color: theme.solid.typography,
        ...theme.typography.metric,
    },
    caption: {
        ...theme.fontSize.sm,
        color: theme.solid.mutedTypography,
    },
    chartWrap: {
        width: '100%',
    },
    legend: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    legendLine: {
        height: 0,
        width: theme.space(5),
        borderTopWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.colors.neutral[400],
    },
    xAxis: {
        marginTop: theme.space(1),
        paddingHorizontal: EDGE,
    },
    xLabel: {
        ...theme.fontSize['2xs'],
        flex: 1,
        textAlign: 'center',
        color: theme.solid.mutedTypography,
    },
}));

/**
 * Completed sessions in each of the last eight weeks, against the weekly target
 * (the same one the streak uses), drawn as a dashed goal line. A bar that clears
 * the line is brand red; one that does not is quiet.
 */
export const SessionsPerWeek: FC = () => {
    const { t, i18n } = useTranslation('screens');
    const { theme } = useUnistyles();
    const { data: workouts = [] } = useWorkouts();
    const { user } = useUser();
    const { target, done } = useWeeklyStreak();
    const [width, setWidth] = useState(0);

    const weeks = useMemo(() => {
        const mondayFirst = user?.firstWeekday !== 1;
        const today = dayjs().startOf('day');
        const thisWeek = today.subtract(mondayFirst ? (today.day() + 6) % 7 : today.day(), 'day');

        return Array.from({ length: WEEKS }, (_, index) => {
            const start = thisWeek.subtract(WEEKS - 1 - index, 'week');
            const count = workouts.filter(
                (workout) =>
                    workout.status === 'completed' &&
                    workout.completedAt &&
                    !dayjs(workout.completedAt).isBefore(start) &&
                    dayjs(workout.completedAt).isBefore(start.add(7, 'day')),
            ).length;

            return { start, count };
        });
    }, [user?.firstWeekday, workouts]);

    const max = Math.max(target, ...weeks.map((week) => week.count), 1);
    const chartWidth = Math.max(1, width - Y_AXIS_AREA);
    const slot = Math.max(1, (chartWidth - EDGE * 2) / WEEKS);
    const barWidth = Math.min(theme.space(7), slot * 0.5);

    return (
        <VStack style={styles.section}>
            <Text style={styles.title}>{t('results.sessionsPerWeek.title')}</Text>
            <VStack style={styles.card}>
                <HStack style={styles.headline}>
                    <Text style={styles.value}>{`${done} / ${target}`}</Text>
                    <Text style={styles.caption}>{t('results.sessionsPerWeek.thisWeek')}</Text>
                </HStack>

                <VStack
                    style={styles.chartWrap}
                    onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
                >
                    {width > 0 ? (
                        <BarChart
                            data={weeks.map((week) => ({
                                value: week.count,
                                frontColor:
                                    week.count >= target
                                        ? theme.colors.brand[500]
                                        : theme.colors.neutral[600],
                            }))}
                            width={chartWidth}
                            height={CHART_HEIGHT}
                            maxValue={max}
                            noOfSections={Math.min(max, 4)}
                            barWidth={barWidth}
                            spacing={slot - barWidth}
                            initialSpacing={EDGE + (slot - barWidth) / 2}
                            endSpacing={EDGE}
                            barBorderRadius={theme.radius.xs}
                            yAxisThickness={0}
                            xAxisThickness={1}
                            xAxisColor={theme.solid.border}
                            rulesColor={theme.solid.border}
                            yAxisTextStyle={{ color: theme.solid.mutedTypography, fontSize: 12 }}
                            yAxisLabelWidth={Y_AXIS_AREA}
                            hideRules={false}
                            disableScroll
                            adjustToWidth
                            showReferenceLine1
                            referenceLine1Position={target}
                            referenceLine1Config={{
                                color: theme.colors.neutral[400],
                                dashWidth: 4,
                                dashGap: 4,
                                thickness: 1.5,
                            }}
                        />
                    ) : null}
                    <HStack style={[styles.xAxis, { marginLeft: Y_AXIS_AREA }]}>
                        {weeks.map((week) => (
                            <Text
                                key={week.start.valueOf()}
                                style={styles.xLabel}
                                numberOfLines={1}
                            >
                                {week.start.locale(i18n.language).format('D MMM')}
                            </Text>
                        ))}
                    </HStack>
                </VStack>

                <HStack style={styles.legend}>
                    <VStack style={styles.legendLine} />
                    <Text style={styles.caption}>
                        {t('results.sessionsPerWeek.goal', { count: target })}
                    </Text>
                </HStack>
            </VStack>
        </VStack>
    );
};
