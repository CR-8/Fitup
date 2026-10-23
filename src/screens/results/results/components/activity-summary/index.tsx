import { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { BarChart } from 'react-native-gifted-charts';
import { Platform } from 'react-native';

import type { WorkoutSelect } from '@/db/schema';
import { useUser } from '@/hooks/use-user';
import { useWorkouts } from '@/hooks/use-workouts';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useAnalytics } from '@/hooks/use-analytics';
import { Icon } from '@/components/primitives/icon';

const CHART_HEIGHT = 172;
const CHART_EDGE_INSET = 6;
const Y_AXIS_LABEL_AREA = 40;

type Week = { start: dayjs.Dayjs; seconds: number };

interface ActivitySummaryProps {
    /** Part of the Results screen contract. Bars are not scrubbable, so it never fires. */
    onScrubbingChange?: (isScrubbing: boolean) => void;
}

const styles = StyleSheet.create((theme) => ({
    section: {
        gap: theme.space(3),
    },
    sectionTitle: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.solid.typography,
    },
    card: {
        backgroundColor: theme.solid.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        padding: theme.space(4),
        gap: theme.space(4),
    },
    monthHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    monthTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.solid.typography,
    },
    monthNavButton: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.solid.inset,
    },
    monthPrevIcon: {
        marginRight: theme.space(0.5),
    },
    monthNextIcon: {
        marginLeft: theme.space(0.5),
    },
    monthNavButtonDisabled: {
        opacity: 0.45,
    },
    valueText: {
        ...theme.fontSize['3xl'],
        ...theme.typography.metric,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.solid.typography,
    },
    comparison: {
        ...theme.fontSize.sm,
        color: theme.solid.typography,
        opacity: 0.6,
    },
    chartWrap: {
        width: '100%',
        alignSelf: 'stretch',
    },
    chartFrame: {
        position: 'relative',
        width: '100%',
    },
    yAxisOverlay: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: Y_AXIS_LABEL_AREA,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    axisLabel: {
        ...theme.fontSize['2xs'],
        color: theme.solid.typography,
        opacity: 0.6,
    },
    xAxisRow: {
        marginTop: theme.space(1),
        paddingHorizontal: CHART_EDGE_INSET,
    },
    xAxisItem: {
        flex: 1,
        textAlign: 'center',
    },
}));

const durationSeconds = (workout: WorkoutSelect): number => {
    if (typeof workout.duration === 'number' && Number.isFinite(workout.duration)) {
        return Math.max(0, workout.duration);
    }
    if (workout.startedAt && workout.completedAt) {
        return Math.max(
            0,
            Math.round((workout.completedAt.getTime() - workout.startedAt.getTime()) / 1000),
        );
    }

    return 0;
};

/** The smallest 1, 2 or 5 times a power of ten that is at least `value`. */
export const niceCeil = (value: number): number => {
    if (value <= 1) return 1;

    const magnitude = 10 ** Math.floor(Math.log10(value));
    const mantissa = value / magnitude;
    const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;

    return nice * magnitude;
};

/** How many gridlines divide `niceMax` into whole, readable steps. */
const sectionsFor = (niceMax: number): number => {
    if (niceMax <= 5) return niceMax;

    const mantissa = niceMax / 10 ** Math.floor(Math.log10(niceMax));

    return mantissa === 2 ? 4 : 5;
};

const formatHours = (seconds: number): string => {
    const hours = seconds / 3600;

    return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}`;
};

const ActivitySummary = (_: ActivitySummaryProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme, rt } = useUnistyles();
    const { data: workouts = [] } = useWorkouts();
    const { user } = useUser();
    const { track } = useAnalytics();
    const [chartWidth, setChartWidth] = useState(0);
    const [visibleMonthStart, setVisibleMonthStart] = useState(() => dayjs().startOf('month'));

    const hr = t('durations.hr', { ns: 'common' });
    const min = t('durations.min', { ns: 'common' });

    const { weeks, monthSeconds, previousSeconds } = useMemo(() => {
        const monthEnd = visibleMonthStart.endOf('month');
        const previousStart = visibleMonthStart.subtract(1, 'month');
        const mondayFirst = user?.firstWeekday !== 1;
        const weekStartOf = (date: dayjs.Dayjs) =>
            date.startOf('day').subtract(mondayFirst ? (date.day() + 6) % 7 : date.day(), 'day');

        const list: Week[] = [];
        for (
            let start = weekStartOf(visibleMonthStart);
            !start.isAfter(monthEnd);
            start = start.add(7, 'day')
        ) {
            list.push({ start, seconds: 0 });
        }

        let month = 0;
        let previous = 0;
        for (const workout of workouts) {
            if (workout.status !== 'completed' || !workout.completedAt) continue;

            const seconds = durationSeconds(workout);
            const completed = dayjs(workout.completedAt);

            if (completed.isSame(visibleMonthStart, 'month')) {
                month += seconds;
                const week = list.find(
                    (entry) =>
                        !completed.isBefore(entry.start, 'day') &&
                        completed.isBefore(entry.start.add(7, 'day'), 'day'),
                );
                if (week) week.seconds += seconds;
            } else if (completed.isSame(previousStart, 'month')) {
                previous += seconds;
            }
        }

        return { weeks: list, monthSeconds: month, previousSeconds: previous };
    }, [user?.firstWeekday, visibleMonthStart, workouts]);

    const maxHours = Math.max(0, ...weeks.map((week) => week.seconds / 3600));
    const niceMax = niceCeil(maxHours);
    const sections = sectionsFor(niceMax);
    const yAxisLabels = Array.from({ length: sections + 1 }, (_value, index) => {
        const value = ((sections - index) * niceMax) / sections;

        return value === 0 ? '0' : `${value}${hr}`;
    });

    const canGoForward = visibleMonthStart.isBefore(dayjs().startOf('month'), 'month');
    const navIconColor = Platform.select({
        ios: theme.solid.typography,
        default: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
    });

    const changeMonth = useCallback(
        (direction: 'previous' | 'next') => {
            track('progress:period_changed', { surface: 'activity_summary', direction });
            setVisibleMonthStart((prev) =>
                prev.add(direction === 'next' ? 1 : -1, 'month').startOf('month'),
            );
        },
        [track],
    );

    const chartContentWidth = Math.max(1, chartWidth - Y_AXIS_LABEL_AREA);
    const slot = Math.max(
        1,
        (chartContentWidth - CHART_EDGE_INSET * 2) / Math.max(1, weeks.length),
    );
    const barWidth = Math.min(theme.space(8), slot * 0.5);
    const barSpacing = slot - barWidth;

    const totalLabel = `${Math.floor(monthSeconds / 3600)}${hr} ${Math.floor((monthSeconds % 3600) / 60)}${min}`;

    return (
        <VStack style={styles.section}>
            <Text style={styles.sectionTitle}>
                {t('results.activitySummary.title', { ns: 'screens' })}
            </Text>
            <VStack style={styles.card}>
                <VStack>
                    <Text style={styles.valueText}>{totalLabel}</Text>
                    <Text style={styles.comparison}>
                        {t('results.activitySummary.vsLastMonth', {
                            ns: 'screens',
                            value: `${formatHours(previousSeconds)}${hr}`,
                        })}
                    </Text>
                </VStack>
                <VStack
                    style={styles.chartWrap}
                    onLayout={(event) => {
                        const width = Math.round(event.nativeEvent.layout.width);
                        if (width > 0 && width !== chartWidth) setChartWidth(width);
                    }}
                >
                    {chartWidth > 0 && (
                        <VStack style={styles.chartFrame}>
                            <BarChart
                                data={weeks.map((week) => ({ value: week.seconds / 3600 }))}
                                width={chartContentWidth}
                                height={CHART_HEIGHT}
                                noOfSections={sections}
                                maxValue={niceMax}
                                frontColor={theme.colors.brand[500]}
                                barBorderRadius={theme.radius.xs}
                                barWidth={barWidth}
                                spacing={barSpacing}
                                initialSpacing={CHART_EDGE_INSET + barSpacing / 2}
                                endSpacing={CHART_EDGE_INSET}
                                xAxisColor={theme.solid.border}
                                xAxisThickness={1}
                                hideYAxisText
                                yAxisLabelWidth={0}
                                yAxisThickness={0}
                                xAxisLabelsHeight={0}
                                labelsExtraHeight={0}
                                hideRules={false}
                                rulesColor={theme.solid.border}
                                rulesThickness={1}
                                disableScroll
                                adjustToWidth
                            />
                            <VStack pointerEvents="none" style={styles.yAxisOverlay}>
                                {yAxisLabels.map((label, index) => (
                                    <Text key={`y-${index}`} style={styles.axisLabel}>
                                        {label}
                                    </Text>
                                ))}
                            </VStack>
                        </VStack>
                    )}
                    <HStack style={[styles.xAxisRow, { width: chartContentWidth }]}>
                        {weeks.map((week) => (
                            <Text
                                key={week.start.valueOf()}
                                numberOfLines={1}
                                style={[styles.axisLabel, styles.xAxisItem]}
                            >
                                {week.start.format('D MMM')}
                            </Text>
                        ))}
                    </HStack>
                </VStack>
                <HStack style={styles.monthHeader}>
                    <Pressable
                        onPress={() => changeMonth('previous')}
                        hitSlop={theme.space(2)}
                        accessibilityRole="button"
                        accessibilityLabel={t('previous', {
                            ns: 'common',
                            defaultValue: 'Previous',
                        })}
                    >
                        <Box style={styles.monthNavButton}>
                            <Icon
                                name="chevron-left"
                                size={theme.space(6)}
                                style={styles.monthPrevIcon}
                                color={navIconColor}
                            />
                        </Box>
                    </Pressable>
                    <Text style={styles.monthTitle}>{visibleMonthStart.format('MMMM YYYY')}</Text>
                    <Pressable
                        onPress={() => canGoForward && changeMonth('next')}
                        disabled={!canGoForward}
                        hitSlop={theme.space(2)}
                        accessibilityRole="button"
                        accessibilityLabel={t('next', { ns: 'common', defaultValue: 'Next' })}
                    >
                        <Box
                            style={[
                                styles.monthNavButton,
                                !canGoForward && styles.monthNavButtonDisabled,
                            ]}
                        >
                            <Icon
                                name="chevron-right"
                                size={theme.space(6)}
                                style={styles.monthNextIcon}
                                color={navIconColor}
                            />
                        </Box>
                    </Pressable>
                </HStack>
            </VStack>
        </VStack>
    );
};

export { ActivitySummary };
