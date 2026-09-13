import { FC, Fragment } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { LucideIcon } from 'lucide-react-native';

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
    /**
     * A leading glyph, which turns the tile into a row: icon, then the figure
     * over its label. Home's streak and month tiles use it; Results doesn't.
     */
    icon?: LucideIcon;
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
    // The 'split' look: each figure is its own bordered tile with a gap
    // between, rather than one row divided by hairlines. Absorbed from
    // Home's former `StatsRow`, which was this component in every way but
    // its surface treatment.
    splitRow: {
        gap: theme.space(3),
    },
    splitBlock: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(0.5),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: theme.space(3.5),
        paddingHorizontal: theme.space(2),
    },
    value: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    valueEmphasised: {
        color: theme.colors.primary,
    },
    label: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
    splitLabel: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
    iconBlock: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
    },
    iconText: {
        flexShrink: 1,
        alignItems: 'flex-start',
    },
    iconLabel: {
        textAlign: 'left',
    },
}));

export const StatBlocks: FC<{
    blocks: StatBlock[];
    /**
     * Whether the row supplies its own gutter. Home's list has none, so it
     * does; Results already pads its scroll view, so it does not.
     */
    inset?: boolean;
    /** 'grouped' (default): one row, hairline dividers. 'split': bordered tiles. */
    variant?: 'grouped' | 'split';
}> = ({ blocks, inset = true, variant = 'grouped' }) => {
    const { theme } = useUnistyles();
    const isSplit = variant === 'split';

    return (
        <Box style={inset ? styles.container : undefined}>
            <HStack style={isSplit ? styles.splitRow : styles.row}>
                {blocks.map((block, index) => (
                    <Fragment key={block.key}>
                        {!isSplit && index > 0 ? <Box style={styles.divider} /> : null}
                        <VStack
                            style={[
                                isSplit ? styles.splitBlock : styles.block,
                                block.icon && styles.iconBlock,
                            ]}
                            accessibilityRole="text"
                            accessibilityLabel={`${block.value} ${block.label}`}
                        >
                            {block.icon ? (
                                <block.icon
                                    size={theme.space(6)}
                                    strokeWidth={2}
                                    color={theme.colors.primary}
                                />
                            ) : null}
                            <VStack style={block.icon ? styles.iconText : undefined}>
                                <Text
                                    style={[
                                        styles.value,
                                        block.emphasised && styles.valueEmphasised,
                                    ]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {block.value}
                                </Text>
                                <Text
                                    style={[
                                        isSplit ? styles.splitLabel : styles.label,
                                        block.icon && styles.iconLabel,
                                    ]}
                                    numberOfLines={2}
                                >
                                    {block.label}
                                </Text>
                            </VStack>
                        </VStack>
                    </Fragment>
                ))}
            </HStack>
        </Box>
    );
};
