import { FC } from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';

interface LabelProps {
    children: string;
    style?: TextProps['style'];
    /**
     * Names the one field right below it, inside a card (auth, onboarding):
     * flush with the field and readable. Without it, iOS draws a grouped-list
     * section header — an indented footnote — which beside an 18pt field read as
     * smaller and further out than the value it names.
     */
    field?: boolean;
}

const styles = StyleSheet.create((theme) => ({
    label: Platform.select({
        // A grouped-list section header: a quiet footnote over the card.
        ios: {
            paddingHorizontal: theme.space(4),
            fontSize: 13,
            lineHeight: 18,
            color: theme.colors.mutedTypography,
        },
        default: {
            ...theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold.fontWeight,
            color: theme.colors.typography,
            opacity: 0.6,
        },
    }),
    // Android's label is already a field label.
    field: Platform.select({
        ios: {
            paddingHorizontal: 0,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: theme.fontWeight.semibold.fontWeight,
            color: theme.colors.typography,
        },
        default: {},
    }),
}));

export const Label: FC<LabelProps> = ({ children, style, field = false }) => (
    <Text style={[styles.label, field && styles.field, style]}>{children}</Text>
);
