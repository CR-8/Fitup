import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';

interface LabelProps {
    children: string;
    style?: TextProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    // A grouped-list section header: a quiet footnote over the card on iOS, a
    // primary-coloured title on Android.
    label: {
        paddingHorizontal: theme.space(4),
        ...(process.env.EXPO_OS === 'android'
            ? {
                  ...theme.fontSize.sm,
                  fontWeight: theme.fontWeight.medium.fontWeight,
                  color: theme.colors.primary,
              }
            : {
                  fontSize: 13,
                  lineHeight: 18,
                  color: theme.colors.mutedTypography,
              }),
    },
}));

export const Label: FC<LabelProps> = ({ children, style }) => (
    <Text style={[styles.label, style]}>{children}</Text>
);
