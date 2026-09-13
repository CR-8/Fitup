import { FC } from 'react';

import { StyleSheet, type UnistylesVariants } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';
import { displayFontFamily } from '@/theme/fonts';

type TitleProps = TextProps & UnistylesVariants<typeof styles>;

/**
 * The weight behind each level, and what's asked of the display face for it.
 *
 * Every level used to render at the same extrabold(800) — the family tops out
 * at 700, so all eight sizes were falling back to one identical cut and the
 * scale was doing size alone, none of the work weight should share with it.
 * h1/h2 also track tighter: negative tracking on large display type is what
 * reads as considered rather than as the platform default stretched bigger.
 */
const styles = StyleSheet.create((theme) => ({
    title: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        variants: {
            type: {
                h1: {
                    ...theme.fontSize['4xl'],
                    letterSpacing: -0.5,
                },
                h2: {
                    ...theme.fontSize['3xl'],
                    letterSpacing: -0.5,
                },
                h3: {
                    ...theme.fontSize['2xl'],
                },
                h4: {
                    ...theme.fontSize.xl,
                },
                h5: {
                    ...theme.fontSize.lg,
                    fontWeight: theme.fontWeight.semibold.fontWeight,
                },
                h6: {
                    ...theme.fontSize.default,
                    fontWeight: theme.fontWeight.semibold.fontWeight,
                },
                h7: {
                    ...theme.fontSize.sm,
                    fontWeight: theme.fontWeight.semibold.fontWeight,
                },
                h8: {
                    ...theme.fontSize.xs,
                    fontWeight: theme.fontWeight.semibold.fontWeight,
                },
            },
        },
    },
}));

/** Mirrors the variants above — h1-h4 bold, h5-h8 semibold. */
const WEIGHT_BY_TYPE: Record<string, number> = {
    h1: 700,
    h2: 700,
    h3: 700,
    h4: 700,
    h5: 600,
    h6: 600,
    h7: 600,
    h8: 600,
};

export const Title: FC<TitleProps> = ({ style, type, ...rest }) => {
    styles.useVariants({ type });

    // Headings are where Space Grotesk does its work — it is the face the design
    // calls `text-display`, and it is on every heading and figure in the mockup.
    const fontFamily = displayFontFamily(WEIGHT_BY_TYPE[type ?? 'h3']);

    return <Text style={[styles.title, { fontFamily }, style]} {...rest} />;
};
