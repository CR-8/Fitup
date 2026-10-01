import { FC } from 'react';

import { StyleSheet, type UnistylesVariants } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';

type TitleProps = TextProps & UnistylesVariants<typeof styles>;

/** h1-h4 bold, h5-h8 semibold, in the system font. */
const styles = StyleSheet.create((theme) => ({
    title: {
        fontWeight: theme.fontWeight.bold.fontWeight,
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

export const Title: FC<TitleProps> = ({ style, type, ...rest }) => {
    styles.useVariants({ type });

    return <Text style={[styles.title, style]} {...rest} />;
};
