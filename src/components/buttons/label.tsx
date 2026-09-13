import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { LucideIcon } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';

/**
 * An icon and its label, centred together — pass it as a `Button` title.
 *
 * `Button`'s own `prefix` is pinned 16px from the edge while the label centres
 * across the whole width, so on anything but a full-width button the two drift
 * apart. A node title owns its colour, so it is given one explicitly.
 */

const styles = StyleSheet.create((theme) => ({
    row: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    text: {
        fontSize: theme.fontSize.default.fontSize,
    },
}));

export const ButtonLabel: FC<{ icon: LucideIcon; label: string; color: string }> = ({
    icon: Icon,
    label,
    color,
}) => {
    const { theme } = useUnistyles();

    return (
        <HStack style={styles.row}>
            <Icon size={theme.space(5)} color={color} strokeWidth={2.5} />
            <Text fontWeight="semibold" style={[styles.text, { color }]}>
                {label}
            </Text>
        </HStack>
    );
};
