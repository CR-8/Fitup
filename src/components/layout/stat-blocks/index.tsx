import { FC, Fragment } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

/**
 * A row of headline numbers: a large value over a quiet label.
 *
 * Taken from the design's own vocabulary — `60s / AI plan`, `7 day / Auto sync`,
 * `500+ / Exercises` — and used wherever a screen needs to lead with figures
 * rather than bury them in a list. Home answers "am I on track this week?" with
 * it; Results opens with the all-time totals.
 *
 * Purely presentational. Everything it shows is derived by the screen above it,
 * so it renders identically for real figures and for the sample ones on Home's
 * empty state. Lives in `components/layout` rather than under one screen
 * because two now share it.
 */

export interface StatBlock {
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

export const StatBlocks: FC<{
    blocks: StatBlock[];
    /**
     * Whether the row supplies its own gutter. Home's list has none, so it
     * does; Results already pads its scroll view, so it does not.
     */
    inset?: boolean;
}> = ({ blocks, inset = true }) => {
    return (
        <Box style={inset ? styles.container : undefined}>
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
