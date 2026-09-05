import { FC } from 'react';

import { StyleSheet, type UnistylesVariants } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';
import { displayFontFamily } from '@/theme/fonts';

type TitleProps = TextProps & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme) => ({
    title: {
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        variants: {
            type: {
                h1: {
                    ...theme.fontSize['4xl'],
                },
                h2: {
                    ...theme.fontSize['3xl'],
                },
                h3: {
                    ...theme.fontSize['2xl'],
                },
                h4: {
                    ...theme.fontSize.xl,
                },
                h5: {
                    ...theme.fontSize.lg,
                },
                h6: {
                    ...theme.fontSize.default,
                },
                h7: {
                    ...theme.fontSize.sm,
                },
                h8: {
                    ...theme.fontSize.xs,
                },
            },
        },
    },
}));

export const Title: FC<TitleProps> = ({ style, type, ...rest }) => {
    styles.useVariants({ type });

    // Headings are where Space Grotesk does its work — it is the face the design
    // calls `text-display`, and it is on every heading and figure in the mockup.
    // Asked for at 800 because that is the weight below; the family stops at 700
    // and `displayFontFamily` falls back to it rather than letting the platform
    // fake a heavier cut.
    const fontFamily = displayFontFamily(800);

    return <Text style={[styles.title, { fontFamily }, style]} {...rest} />;
};
