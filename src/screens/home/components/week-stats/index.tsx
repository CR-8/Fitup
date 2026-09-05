import { FC, Fragment } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

/**
 * Three numbers, taken from the design's own vocabulary.
 *
 * The reference site leads with `60s / AI plan`, `7 day / Auto sync`,
 * `500+ / Exercises` — a large value over a quiet label. The same shape answers
 * a more useful question here: am I on track this week?
 *
 * Purely presentational. Everything it shows is derived by the screen above it,
 * so it renders identically for a real week and for the sample figures on the
 * empty state.
 */

export interface WeekStatsBlock {
    key: string;
    value: string;
    label: string;
    /** Draws the value in the accent colour. Used for progress against a goal. */
    emphasised?: boolean;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    row: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        paddingVertical: theme.space(4),
    },
    block: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(0.5),
        paddingHorizontal: theme.space(2),
    },
    // A hairline between blocks rather than boxes around them, so the row reads
    // as one object.
    divider: {
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
        marginVertical: theme.space(1),
        backgroundColor: theme.colors.border,
    },
    value: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    valueEmphasised: {
        color: theme.colors.primary,
    },
    label: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
}));

export const WeekStatsBlocks: FC<{ blocks: WeekStatsBlock[] }> = ({ blocks }) => {
    return (
        <Box style={styles.container}>
            <HStack style={styles.row}>
                {blocks.map((block, index) => (
                    <Fragment key={block.key}>
                        {index > 0 ? <Box style={styles.divider} /> : null}
                        <VStack
                            style={styles.block}
                            accessibilityRole="text"
                            accessibilityLabel={`${block.value} ${block.label}`}
                        >
                            <Text
                                style={[styles.value, block.emphasised && styles.valueEmphasised]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {block.value}
                            </Text>
                            <Text style={styles.label} numberOfLines={2}>
                                {block.label}
                            </Text>
                        </VStack>
                    </Fragment>
                ))}
            </HStack>
        </Box>
    );
};
