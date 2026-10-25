import { FC, ReactNode } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Swipe between the tabs, in tab bar order: Home, Syn, Progress, Profile.
 * Swiping left opens the tab to the right, swiping right the one to the left;
 * Home has nothing before it and Profile nothing after. Vertical scrolling is
 * left alone: a mostly vertical drag fails the swipe.
 */

const TABS = ['/', '/syn', '/results', '/you'];

const styles = StyleSheet.create({
    fill: { flex: 1 },
});

export const TabSwipe: FC<{ index: number; children: ReactNode }> = ({ index, children }) => {
    const swipe = Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-25, 25])
        .failOffsetY([-15, 15])
        .onEnd(({ translationX, velocityX }) => {
            if (Math.abs(translationX) < 60 && Math.abs(velocityX) < 500) return;
            const target = TABS[index + (translationX < 0 ? 1 : -1)];
            if (target) router.navigate(target as Href);
        });

    return (
        <GestureDetector gesture={swipe}>
            <View style={styles.fill}>{children}</View>
        </GestureDetector>
    );
};
