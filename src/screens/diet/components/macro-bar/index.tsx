import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(1.5),
        flex: 1,
    },
    labelRow: {
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: theme.space(2),
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    track: {
        height: theme.space(1.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    // Overshooting a target is information, not an error, so it is shown in the
    // warning colour rather than the destructive one.
    fill: (ratio: number, over: boolean) => ({
        width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
        height: '100%',
        borderRadius: theme.radius.full,
        backgroundColor: over ? theme.colors.amber[500] : theme.colors.brand[500],
    }),
}));

interface MacroBarProps {
    label: string;
    consumed: number;
    target: number | null;
    unit?: string;
}

export const MacroBar: FC<MacroBarProps> = ({ label, consumed, target, unit }) => {
    const rounded = Math.round(consumed);
    const hasTarget = typeof target === 'number' && target > 0;
    const ratio = hasTarget ? consumed / target : 0;

    return (
        <VStack style={styles.container}>
            <HStack style={styles.labelRow}>
                <Text fontSize="xs" fontWeight="medium">
                    {label}
                </Text>
                <Text fontSize="2xs" style={styles.muted}>
                    {hasTarget
                        ? `${rounded} / ${Math.round(target)}${unit ?? ''}`
                        : `${rounded}${unit ?? ''}`}
                </Text>
            </HStack>

            {hasTarget ? (
                <Box style={styles.track}>
                    <Box style={styles.fill(ratio, ratio > 1)} />
                </Box>
            ) : null}
        </VStack>
    );
};
