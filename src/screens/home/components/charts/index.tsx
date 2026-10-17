import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { Chart, Gauge, HStack, Host, Text } from '@expo/ui/swift-ui';
import { font, foregroundStyle, gaugeStyle, scaleEffect, tint } from '@expo/ui/swift-ui/modifiers';

import type {
    AxisBarsProps,
    BarsProps,
    LineProps,
    MetricProps,
    PeriodPickerProps,
    RingProps,
} from './types';

/**
 * Today's dashboard controls on iOS, all native: UISegmentedControl, Swift
 * Charts, a SwiftUI capacity gauge and SF Rounded figures. Android draws its
 * own: `index.android.tsx`.
 */

const styles = StyleSheet.create({
    bars: { height: 64 },
    axisBars: { height: 170 },
    line: { height: 56 },
    picker: { height: 32 },
});

/** The capacity gauge's own diameter, which `Ring` scales up to its size. */
const GAUGE_SIZE = 58;

export const PeriodPicker: FC<PeriodPickerProps> = ({ labels, index, onChange }) => (
    <SegmentedControl
        style={styles.picker}
        values={labels}
        selectedIndex={index}
        onChange={({ nativeEvent }) => onChange(nativeEvent.selectedSegmentIndex)}
    />
);

export const Bars: FC<BarsProps> = ({ data, current, color }) => (
    <Host style={styles.bars}>
        <Chart
            type="bar"
            showGrid={false}
            animate
            barStyle={{ cornerRadius: 3 }}
            data={data.map((y, i) => ({
                x: String(i),
                y,
                // The bucket we are in now is solid, the rest recede.
                color: current < 0 || i === current ? color : `${color}59`,
            }))}
        />
    </Host>
);

/** A chart card's bars, with Swift Charts' own grid and axes. */
export const AxisBars: FC<AxisBarsProps> = ({ data, x, color }) => (
    <Host style={styles.axisBars}>
        <Chart
            type="bar"
            showGrid
            animate
            barStyle={{ cornerRadius: 3 }}
            data={data.map((y, i) => ({ x: x[i], y, color }))}
        />
    </Host>
);

export const Line: FC<LineProps> = ({ data, color }) => (
    <Host style={styles.line}>
        <Chart
            type="line"
            showGrid={false}
            animate
            lineStyle={{ color, width: 2.5, pointSize: 0 }}
            data={data.map((y, x) => ({ x, y }))}
        />
    </Host>
);

export const Ring: FC<RingProps> = ({ progress, color, size }) => (
    <Host style={{ width: size, height: size }}>
        <Gauge
            value={Math.min(Math.max(progress, 0), 1)}
            modifiers={[
                gaugeStyle('circularCapacity'),
                tint(color),
                scaleEffect(size / GAUGE_SIZE),
            ]}
        />
    </Host>
);

export const Metric: FC<MetricProps> = ({ value, unit, color, size = 34 }) => (
    <Host matchContents>
        <HStack alignment="firstTextBaseline" spacing={2}>
            <Text
                modifiers={[
                    font({ size, weight: 'semibold', design: 'rounded' }),
                    foregroundStyle(color),
                ]}
            >
                {value}
            </Text>
            {unit ? (
                <Text
                    modifiers={[
                        font({ size: size / 2, weight: 'bold', design: 'rounded' }),
                        foregroundStyle(color),
                    ]}
                >
                    {unit.toUpperCase()}
                </Text>
            ) : null}
        </HStack>
    </Host>
);
