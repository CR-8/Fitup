import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useKeyboard } from '@react-native-community/hooks';
import { StyleSheet } from 'react-native-unistyles';

import { FrostedGlass } from '@/components/primitives/frosted-glass';

import { Tabs } from './components';

/**
 * Android's tab bar, drawn to match iOS's: a frosted-glass pill floating over
 * the content, inset from the screen edges and the gesture bar.
 */

const styles = StyleSheet.create((theme, rt) => ({
    bar: {
        position: 'absolute',
        bottom: rt.insets.bottom + theme.space(2),
        left: theme.space(5),
        right: theme.space(5),
        zIndex: 1000,
        borderRadius: theme.radius.full,
    },
}));

const Menu = ({ state }: BottomTabBarProps) => {
    const { keyboardShown } = useKeyboard();

    // The bar is pinned to the bottom of the window, and Android is configured to pan
    // the window on keyboard open, so leaving it mounted drags the whole nav up over
    // the keyboard. Standing it down while typing is both the fix and the behaviour
    // people expect from a text entry surface.
    if (keyboardShown) return null;

    return (
        <FrostedGlass style={styles.bar}>
            <Tabs state={state} />
        </FrostedGlass>
    );
};

export { Menu };
