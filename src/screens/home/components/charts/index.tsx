import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { Chart, Host } from '@expo/ui/swift-ui';

import type { AxisBarsProps, BarsProps, LineProps, PeriodPickerProps } from './types';

/**
 * Today's dashboard controls on iOS, all native: UISegmentedControl and Swift
 * Charts. Android draws its own: `index.android.tsx`. The activity ring and
 * the figures are shared (`ring.tsx`, `metric.tsx`).
 */

const styles = StyleSheet.create({
    bars: { height: 64 },
    axisBars: { height: 170 },
    line: { height: 56 },
    picker: { height: 32 },
});

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

export { Ring, Rings } from './ring';

export { Metric } from './metric';
