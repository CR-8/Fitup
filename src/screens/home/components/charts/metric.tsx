import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';

import type { MetricProps } from './types';

/**
 * A figure and its unit, Apple Fitness's "46CAL": the metric face (SF Rounded on
 * iOS, Space Grotesk on Android, see `typography.metric`), the unit at half size
 * in capitals, both in the figure's colour.
 *
 * Plain text on both platforms: as a SwiftUI host it measured itself after the
 * card had been laid out, and spilled out of the bottom of it.
 */

const styles = StyleSheet.create((theme) => ({
    row: {
        alignItems: 'baseline',
        gap: 2,
    },
    value: (size: number) => ({
        fontSize: size,
        lineHeight: Math.round(size * 1.2),
        ...theme.typography.metric,
    }),
}));

export const Metric: FC<MetricProps> = ({ value, unit, color, size = 34 }) => (
    <HStack style={styles.row}>
        <Text style={[styles.value(size), { color }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
        </Text>
        {unit ? (
            <Text style={[styles.value(Math.round(size / 2)), { color }]}>
                {unit.toUpperCase()}
            </Text>
        ) : null}
    </HStack>
);
