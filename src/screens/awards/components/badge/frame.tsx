import { FC } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { ProgressLineProps } from './types';

/** An award's progress toward its target, as a thin bar. */

const styles = StyleSheet.create((theme) => ({
    track: {
        height: 6,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.neutral[700],
        overflow: 'hidden',
    },
}));

export const ProgressLine: FC<ProgressLineProps> = ({ progress, color }) => (
    <View style={styles.track}>
        <View
            style={{
                width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
                minWidth: 6,
                height: '100%',
                borderRadius: 3,
                backgroundColor: color,
            }}
        />
    </View>
);
