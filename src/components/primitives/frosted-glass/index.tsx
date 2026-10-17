import { FC, PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Android's stand-in for iOS's glass material (the Liquid Glass tab bar, menus):
 * a translucent dark fill, a light sheen across the top, a hairline edge and a
 * soft shadow, so content scrolling underneath shows through, dimmed.
 *
 * ponytail: no real backdrop blur (expo-blur on Android needs a BlurTargetView
 * around the content behind it); add it if the translucency reads too busy.
 */

const styles = StyleSheet.create({
    glass: {
        overflow: 'hidden',
        backgroundColor: 'rgba(28, 30, 35, 0.78)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        boxShadow: '0 10px 30px 0 rgba(0, 0, 0, 0.45)',
    },
});

const SHEEN = [
    'rgba(255, 255, 255, 0.10)',
    'rgba(255, 255, 255, 0.02)',
    'rgba(255, 255, 255, 0)',
] as const;

export const FrostedGlass: FC<PropsWithChildren<{ style?: StyleProp<ViewStyle> }>> = ({
    style,
    children,
}) => (
    <View style={[styles.glass, style]}>
        <LinearGradient
            colors={SHEEN}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
        />
        {children}
    </View>
);
