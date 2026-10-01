import { FC } from 'react';
import {
    Pressable as DefaultPressable,
    PressableProps as DefaultPressableProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

/**
 * The platform's own touch feedback: a highlight on iOS, a ripple on Android.
 * `animateOnPress={false}` turns it off where an ancestor already answers the
 * touch.
 */
export type PressableProps = Omit<DefaultPressableProps, 'style'> & {
    style?: StyleProp<ViewStyle>;
    animateOnPress?: boolean;
};

const RIPPLE = { color: 'rgba(127, 127, 127, 0.2)', foreground: true };

export const Pressable: FC<PressableProps> = ({ animateOnPress = true, style, ...rest }) => {
    if (!animateOnPress) return <DefaultPressable style={style} {...rest} />;

    return (
        <DefaultPressable
            android_ripple={RIPPLE}
            style={({ pressed }) => [
                style,
                pressed && process.env.EXPO_OS === 'ios' && { opacity: 0.6 },
            ]}
            {...rest}
        />
    );
};
