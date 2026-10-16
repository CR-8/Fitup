import { FC } from 'react';
import type { ColorValue } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';

/**
 * A flat progress bar, or a row of segments when `segments` is given (one per
 * glass of water). Deliberately not a ring: rings in this app would read as
 * the system's activity rings, which mean something else.
 */

/** Past this many a row of segments is noise; draw a plain bar instead. */
const MAX_SEGMENTS = 16;

const styles = StyleSheet.create((theme) => ({
    track: {
        overflow: 'hidden',
        borderRadius: theme.radius.full,
    },
    segments: {
        gap: theme.space(1),
    },
    segment: {
        flex: 1,
        borderRadius: theme.radius.full,
    },
}));

interface ProgressBarProps {
    /** 0 to 1; anything beyond is clamped, so an over-target day shows full. */
    value: number;
    color?: ColorValue;
    trackColor?: ColorValue;
    height?: number;
    segments?: number;
    accessibilityLabel: string;
}

export const ProgressBar: FC<ProgressBarProps> = ({
    value,
    color,
    trackColor,
    height = 8,
    segments,
    accessibilityLabel,
}) => {
    const { theme } = useUnistyles();
    const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    const fill = color ?? theme.colors.primary;
    const track = trackColor ?? theme.colors.elevated;
    const a11y = {
        accessible: true,
        accessibilityRole: 'progressbar' as const,
        accessibilityLabel,
        accessibilityValue: { min: 0, max: 100, now: Math.round(clamped * 100) },
    };

    if (segments && segments > 1 && segments <= MAX_SEGMENTS) {
        // A small epsilon so 5/8 of 8 is 5, not 4.999….
        const filled = Math.floor(clamped * segments + 1e-6);

        return (
            <HStack style={styles.segments} {...a11y}>
                {Array.from({ length: segments }, (_, index) => (
                    <Box
                        key={index}
                        style={[
                            styles.segment,
                            { height, backgroundColor: index < filled ? fill : track },
                        ]}
                    />
                ))}
            </HStack>
        );
    }

    return (
        <Box style={[styles.track, { height, backgroundColor: track }]} {...a11y}>
            <Box style={{ height, width: `${clamped * 100}%`, backgroundColor: fill }} />
        </Box>
    );
};
