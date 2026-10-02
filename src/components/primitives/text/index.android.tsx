import { FC } from 'react';
import { Text as DefaultText } from 'react-native';
import { StyleSheet, type UnistylesVariants } from 'react-native-unistyles';

import { bodyFontFamily } from '@/theme/fonts';

type ThemedText = DefaultText['props'] & UnistylesVariants<typeof styles>;

export type TextProps = ThemedText;

/** The numeric weight behind each name in the theme's scale. */
const WEIGHTS: Record<string, number> = {
    default: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
};

const styles = StyleSheet.create((theme) => ({
    text: {
        variants: {
            fontSize: {
                ...theme.fontSize,
            },
            fontWeight: {
                ...theme.fontWeight,
            },
        },
    },
    textColor: {
        color: theme.colors.typography,
    },
}));

export const Text: FC<TextProps> = ({ style, fontSize, fontWeight, ...rest }) => {
    styles.useVariants({ fontSize, fontWeight });

    // Read rather than subscribed to: this renders on nearly every screen many
    // times over, and a language change re-renders the tree through the
    // translation hooks above it anyway.
    const fontFamily = bodyFontFamily(WEIGHTS[fontWeight ?? 'default']);

    return <DefaultText style={[styles.text, styles.textColor, { fontFamily }, style]} {...rest} />;
};
