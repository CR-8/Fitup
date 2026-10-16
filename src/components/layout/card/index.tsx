import { FC, PropsWithChildren, ReactNode } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(4),
        gap: theme.space(3),
    },
    titleRow: {
        alignItems: 'center',
        gap: theme.space(2),
        minHeight: theme.space(6),
    },
    title: {
        ...theme.fontSize.default,
        flex: 1,
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
                <Icon name="chevron-right" size={16} color={theme.colors.mutedTypography} />
            ) : null}
        </HStack>
    );
};
