import { FC } from 'react';
import type { ColorValue } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Card, CardTitle } from '@/components/layout/card';

/**
 * The reference summary's two-column grid: each tile a title, a short caption
 * for the range ("All time", "This week"), and one large figure in the
 * metric's own colour. A tile without a real figure shows an em dash.
 */

export interface MetricTile {
    key: string;
    title: string;
    caption: string;
    value: string;
    /** Small, after the figure: "h", "wk". */
    unit?: string;
    color: ColorValue;
    onPress?: () => void;
}

const styles = StyleSheet.create((theme) => ({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space(3),
    },
    tile: {
        // Two to a row, with the gap between them.
        flexBasis: '47%',
        flexGrow: 1,
        gap: theme.space(1),
    },
    caption: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    valueRow: {
        alignItems: 'baseline',
        gap: theme.space(1),
    },
    value: {
        fontSize: 34,
        lineHeight: 38,
        ...theme.typography.metric,
    },
    unit: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
}));

export const MetricTiles: FC<{ tiles: MetricTile[] }> = ({ tiles }) => (
    <HStack style={styles.grid}>
        {tiles.map((tile) => (
            <Card
                key={tile.key}
                style={styles.tile}
                onPress={tile.onPress}
                accessibilityLabel={`${tile.title}, ${tile.caption}, ${tile.value}${tile.unit ? ` ${tile.unit}` : ''}`}
            >
                <CardTitle title={tile.title} chevron={!!tile.onPress} />
                <VStack>
                    <Text style={styles.caption}>{tile.caption}</Text>
                    <HStack style={styles.valueRow}>
                        <Text style={[styles.value, { color: tile.color }]}>{tile.value}</Text>
                        {tile.unit ? (
                            <Text style={[styles.unit, { color: tile.color }]}>{tile.unit}</Text>
                        ) : null}
                    </HStack>
                </VStack>
            </Card>
        ))}
    </HStack>
);
