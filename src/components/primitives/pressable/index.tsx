import { FC, useCallback } from 'react';
import {
    Pressable as DefaultPressable,
    PressableProps as DefaultPressableProps,
    type GestureResponderEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Every tappable surface in the app answers to a touch.
 *
 * This was a bare pass-through, so nothing in the app moved when it was
 * pressed — the single biggest reason a technically clean interface reads as
 * static. Putting the feedback here rather than on individual screens means the
 * ~40 call sites and `Button`, which composes this, all get it at once and all
 * get the *same* one.
 *
 * Transform-only on purpose: a scale never reflows the row it sits in, so no
 * existing layout can shift as a result. `style` narrows to the object form —
 * Pressable's `({ pressed }) => …` variant is unused across the codebase, and
 * dropping it is what lets the animated transform merge in without a cast.
 */

const AnimatedPressable = Reanimated.createAnimatedComponent(DefaultPressable);

const PRESSED_SCALE = 0.97;
/** Short enough to feel like a response to the finger rather than an effect. */
const PRESS_DURATION_MS = 90;
const RELEASE_DURATION_MS = 130;

export type PressableProps = Omit<DefaultPressableProps, 'style'> & {
    style?: StyleProp<ViewStyle>;
    /**
     * Opt out where an ancestor already animates the same touch, or where the
     * press target is the whole screen.
     */
    animateOnPress?: boolean;
};

export const Pressable: FC<PressableProps> = ({
    animateOnPress = true,
    style,
    onPressIn,
    onPressOut,
    ...rest
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.get() }],
    }));

    const handlePressIn = useCallback(
        (event: GestureResponderEvent) => {
            scale.set(withTiming(PRESSED_SCALE, { duration: PRESS_DURATION_MS }));
            onPressIn?.(event);
        },
        [onPressIn, scale],
    );

    const handlePressOut = useCallback(
        (event: GestureResponderEvent) => {
            scale.set(withTiming(1, { duration: RELEASE_DURATION_MS }));
            onPressOut?.(event);
        },
        [onPressOut, scale],
    );

    if (!animateOnPress) {
        return (
            <DefaultPressable
                style={style}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                {...rest}
            />
        );
    }

    return (
        <AnimatedPressable
            style={[style, animatedStyle]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            {...rest}
        />
    );
};
