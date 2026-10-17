import { FC, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';

import type {
    AxisBarsProps,
    BarsProps,
    LineProps,
    MetricProps,
    PeriodPickerProps,
    RingProps,
} from './types';

/**
 * Today's dashboard controls on Android, drawn by the app: the same shapes the
 * iOS file gets from SwiftUI, so both platforms lay out alike.
 */

const BARS_HEIGHT = 64;
const LINE_HEIGHT = 56;
const PLOT_HEIGHT = 140;
const Y_AXIS_WIDTH = 44;

/** The axis top: the max rounded up to 1, 2, 4, 6 or 10 of its power of ten, so halves read cleanly. */
const niceMax = (value: number) => {
    if (value <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 4, 6, 10].find((n) => value / power <= n) ?? 10;

    return step * power;
};

const formatAxis = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const styles = StyleSheet.create((theme) => ({
    picker: {
        gap: theme.space(1),
    },
    segment: (selected: boolean) => ({
        flex: 1,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: selected ? theme.colors.neutral[50] : 'transparent',
    }),
    segmentText: (selected: boolean) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? theme.colors.neutral[950] : theme.colors.mutedTypography,
    }),
    bars: (dense: boolean) => ({
        height: BARS_HEIGHT,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: dense ? 2 : 4,
    }),
    bar: {
        flex: 1,
        borderRadius: 3,
    },
    line: {
        height: LINE_HEIGHT,
    },
    plot: {
        flex: 1,
        height: PLOT_HEIGHT,
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.neutral[600],
    },
    yAxis: {
        width: Y_AXIS_WIDTH,
        height: PLOT_HEIGHT,
        justifyContent: 'space-between',
        paddingLeft: theme.space(1.5),
        marginVertical: -6,
    },
    axisText: {
        fontSize: 11,
        lineHeight: 12,
        color: theme.colors.mutedTypography,
    },
    xAxis: {
        height: 16,
        marginTop: theme.space(1),
        marginRight: Y_AXIS_WIDTH,
    },
    tick: {
        position: 'absolute',
        left: 0,
        width: 48,
    },
    metric: {
        alignItems: 'baseline',
        gap: 2,
    },
    value: (size: number) => ({
        fontSize: size,
        lineHeight: size * 1.15,
        fontWeight: theme.fontWeight.bold.fontWeight,
    }),
}));

export const PeriodPicker: FC<PeriodPickerProps> = ({ labels, index, onChange }) => (
    <HStack style={styles.picker} accessibilityRole="tablist">
        {labels.map((label, i) => (
            <Pressable
                key={label}
                style={styles.segment(i === index)}
                onPress={() => onChange(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: i === index }}
            >
                <Text style={styles.segmentText(i === index)}>{label}</Text>
            </Pressable>
        ))}
    </HStack>
);

export const Bars: FC<BarsProps> = ({ data, current, color }) => {
    const max = Math.max(...data, 1);

    return (
        <View style={styles.bars(data.length > 12)}>
            {data.map((y, i) => (
                <View
                    key={i}
                    style={[
                        styles.bar,
                        {
                            // A stub for empty buckets, as the iOS chart's baseline reads.
                            height: `${Math.max((y / max) * 100, 4)}%`,
                            backgroundColor: color,
                            opacity: current < 0 || i === current ? 1 : 0.35,
                        },
                    ]}
                />
            ))}
        </View>
    );
};

/** A chart card's bars over a three-line grid, max / half / zero labelled on the trailing edge. */
export const AxisBars: FC<AxisBarsProps> = ({ data, ticks, color }) => {
    const max = niceMax(Math.max(...data, 0));

    return (
        <VStack>
            <HStack>
                <View style={styles.plot}>
                    {[0, 0.5, 1].map((at) => (
                        <View key={at} style={[styles.gridLine, { top: at * PLOT_HEIGHT }]} />
                    ))}
                    <View style={[styles.bars(data.length > 12), { height: PLOT_HEIGHT }]}>
                        {data.map((y, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.bar,
                                    { height: `${(y / max) * 100}%`, backgroundColor: color },
                                ]}
                            />
                        ))}
                    </View>
                </View>
                <View style={styles.yAxis}>
                    {[max, max / 2, 0].map((value) => (
                        <Text key={value} style={styles.axisText}>
                            {formatAxis(value)}
                        </Text>
                    ))}
                </View>
            </HStack>
            <HStack style={[styles.xAxis, { gap: data.length > 12 ? 2 : 4 }]}>
                {ticks.map((tick, i) => (
                    <View key={i} style={styles.bar}>
                        <Text style={[styles.axisText, styles.tick]} numberOfLines={1}>
                            {tick}
                        </Text>
                    </View>
                ))}
            </HStack>
        </VStack>
    );
};

export const Line: FC<LineProps> = ({ data, color }) => {
    const [width, setWidth] = useState(0);
    const max = Math.max(...data, Number.EPSILON);
    const pad = 5;
    const points = data.map((y, i) => [
        pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2),
        LINE_HEIGHT - pad - (y / max) * (LINE_HEIGHT - pad * 2),
    ]);
    const [endX, endY] = points[points.length - 1] ?? [0, 0];

    return (
        <View style={styles.line} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && points.length > 0 ? (
                <Svg width={width} height={LINE_HEIGHT}>
                    <Path
                        d={`M${points.map((point) => point.join(',')).join('L')}`}
                        stroke={color}
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <Circle cx={endX} cy={endY} r={4} fill={color} />
                </Svg>
            ) : null}
        </View>
    );
};

export const Ring: FC<RingProps> = ({ progress, color, size }) => {
    const stroke = size * 0.11;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const filled = Math.min(Math.max(progress, 0), 1);

    return (
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                // The track is the ring's own colour, dimmed, as Apple's rings are.
                stroke={`${color}33`}
                strokeWidth={stroke}
                fill="none"
            />
            {filled > 0 ? (
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={circumference * (1 - filled)}
                    strokeLinecap="round"
                    fill="none"
                />
            ) : null}
        </Svg>
    );
};

export const Metric: FC<MetricProps> = ({ value, unit, color, size = 34 }) => (
    <HStack style={styles.metric}>
        <Text style={[styles.value(size), { color }]}>{value}</Text>
        {unit ? (
            <Text style={[styles.value(size / 2), { color }]}>{unit.toUpperCase()}</Text>
        ) : null}
    </HStack>
);
