import { FC, PropsWithChildren, ReactNode } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon, type IconName } from '@/components/primitives/icon';

/**
 * The dashboard card: one surface, one title, one metric, one interaction.
 * The press answer is the platform's own (`Pressable`), so a tappable card
 * feels like every other tappable thing in the app.
 */

const styles = StyleSheet.create((theme) => ({
    // The Summary card: no outline, 22pt continuous corners, as Apple Fitness's.
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: 22,
        borderCurve: 'continuous',
        padding: theme.space(4),
        gap: theme.space(3),
    },
    titleRow: {
        alignItems: 'center',
        gap: theme.space(2),
        minHeight: theme.space(6),
    },
    chevron: {
        height: 26,
        width: 26,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.elevated,
    },
    title: {
        flex: 1,
        fontSize: 19,
        lineHeight: 24,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
}));

interface CardProps extends PropsWithChildren {
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

export const Card: FC<CardProps> = ({
    onPress,
    style,
    children,
    accessibilityLabel,
    accessibilityHint,
}) => {
    if (!onPress) {
        return (
            <VStack style={[styles.card, style]} accessibilityLabel={accessibilityLabel}>
                {children}
            </VStack>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            style={[styles.card, style]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
        >
            {children}
        </Pressable>
    );
};

interface CardTitleProps {
    title: string;
    icon?: IconName;
    /** The metric's own colour, which tints the glyph only. */
    color?: ColorValue;
    /** A trailing chevron, for a card that opens a detail. */
    chevron?: boolean;
    /** Anything else for the trailing edge, e.g. a quick action. */
    trailing?: ReactNode;
}

export const CardTitle: FC<CardTitleProps> = ({ title, icon, color, chevron, trailing }) => {
    const { theme } = useUnistyles();

    return (
        <HStack style={styles.titleRow}>
            {icon ? <Icon name={icon} size={18} color={color ?? theme.colors.primary} /> : null}
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                {title}
            </Text>
            {trailing}
            {chevron ? (
                <Box style={styles.chevron}>
                    <Icon name="chevron-right" size={12} color={theme.colors.mutedTypography} />
                </Box>
            ) : null}
        </HStack>
    );
};
