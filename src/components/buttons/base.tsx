import { FC, ReactNode } from 'react';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';

import { Pressable, PressableProps } from '../primitives/pressable';
import { Text, TextProps } from '../primitives/text';
import { Box, BoxProps } from '../primitives/box';
import { HStack } from '../primitives/hstack';
import Spinner from '../feedback/spinner';

/**
 * Accessibility props are forwarded to the underlying Pressable rather than
 * re-declared here: a button whose title is an icon, or whose label needs to say
 * more than the title does, has no other way to describe itself, and screen
 * readers were previously announcing these as unlabelled.
 */
type ButtonAccessibilityProps = Pick<
    PressableProps,
    | 'accessibilityRole'
    | 'accessibilityLabel'
    | 'accessibilityHint'
    | 'accessibilityState'
    | 'accessibilityValue'
    | 'testID'
>;

export type ButtonProps = {
    /**
     * A string is styled by the button — including the inverted colour that
     * makes it readable on the button's ground. A node is rendered as given, so
     * it inherits `theme.colors.typography`, which is the colour of the ground
     * itself: whoever passes one owns the contrast. Prefer a string plus
     * `textStyle`.
     */
    title?: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    spinnerColor?: string;
    containerStyle?: BoxProps['style'];
    textStyle?: TextProps['style'];
    onPress?: () => void;
    prefix?: ReactNode;
    suffix?: ReactNode;
} & ButtonAccessibilityProps &
    UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        variants: {
            type: {
                default: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    backgroundColor:
                        rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
                    borderRadius: theme.radius.full,
                },
                link: {
                    backgroundColor: 'transparent',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: theme.space(1.5),
                },
            },
            size: {
                default: {
                    height: theme.space(14),
                },
                sm: {
                    height: theme.space(11),
                },
                lg: {
                    height: theme.space(16),
                },
            },
        },
        compoundVariants: [
            {
                type: 'link',
                styles: {
                    height: 'auto',
                },
            },
        ],
    },
    title: {
        variants: {
            type: {
                default: {
                    color:
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50],
                },
                link: {
                    color: theme.colors.typography,
                },
            },
            size: {
                default: {
                    fontSize: theme.fontSize.default.fontSize,
                },
                sm: {
                    fontSize: theme.fontSize.sm.fontSize,
                },
                lg: {
                    fontSize: theme.fontSize.lg.fontSize,
                },
            },
        },
    },
    fixContainer: (title: boolean) => ({
        variants: {
            type: {
                default: {
                    position: title ? 'absolute' : 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                },
            },
            size: {},
        },
    }),
    prefixContainer: (title: boolean) => ({
        variants: {
            type: {
                default: {
                    left: title ? theme.space(4) : 0,
                },
                link: {
                    left: 0,
                },
            },
            size: {},
        },
    }),
    suffixContainer: (title: boolean) => ({
        right: title ? theme.space(4) : 0,
    }),
}));

const Button: FC<ButtonProps> = ({
    title,
    disabled = false,
    loading = false,
    onPress,
    containerStyle,
    textStyle,
    spinnerColor,
    prefix,
    suffix,
    type,
    size,
    ...accessibility
}) => {
    styles.useVariants({ type, size });

    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            accessibilityRole="button"
            {...accessibility}
        >
            <HStack style={[styles.container, containerStyle]}>
                {loading ? (
                    <Spinner color={spinnerColor} />
                ) : (
                    <>
                        {prefix && (
                            <Box
                                style={[
                                    styles.fixContainer(!!title),
                                    styles.prefixContainer(!!title),
                                ]}
                            >
                                {prefix}
                            </Box>
                        )}
                        {title && (
                            <>
                                {typeof title === 'string' ? (
                                    <Text fontWeight="semibold" style={[styles.title, textStyle]}>
                                        {title}
                                    </Text>
                                ) : (
                                    title
                                )}
                            </>
                        )}
                        {suffix && (
                            <Box
                                style={[
                                    styles.fixContainer(!!title),
                                    styles.suffixContainer(!!title),
                                ]}
                            >
                                {suffix}
                            </Box>
                        )}
                    </>
                )}
            </HStack>
        </Pressable>
    );
};

export { Button };
