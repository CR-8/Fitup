import { FC, PropsWithChildren, useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Swipe between the top-level screens, in tab order: a quick swipe left moves
 * to the next one (Today, Syn, Progress), right to the previous. A fling, not
 * a drag, so a vertical scroll and a slow horizontal one are left alone.
 */

const TABS = ['/', '/syn', '/results'] as const;
export type TabPath = (typeof TABS)[number];

const styles = StyleSheet.create({
    fill: { flex: 1 },
});

export const TabSwipe: FC<PropsWithChildren<{ tab: TabPath }>> = ({ tab, children }) => {
    const gesture = useMemo(() => {
        const index = TABS.indexOf(tab);
        const go = (offset: number) => {
            const next = TABS[index + offset];
            if (next) router.navigate(next as never);
        };

        return Gesture.Race(
            Gesture.Fling()
                .direction(Directions.LEFT)
                .runOnJS(true)
                .onEnd(() => go(1)),
            Gesture.Fling()
                .direction(Directions.RIGHT)
                .runOnJS(true)
                .onEnd(() => go(-1)),
        );
    }, [tab]);

    return (
        <GestureDetector gesture={gesture}>
            <View style={styles.fill} collapsable={false}>
                {children}
            </View>
        </GestureDetector>
    );
};
