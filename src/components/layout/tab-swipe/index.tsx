import { FC, ReactNode, useCallback, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Swipe between the tabs, in tab bar order: Home, Syn, Progress, Profile.
 * Swiping left opens the tab to the right, swiping right the one to the left;
 * Home has nothing before it and Profile nothing after. Vertical scrolling is
 * left alone: a mostly vertical drag fails the swipe.
 *
 * The screen follows the finger, slides out the way it was pushed, and the
 * next tab slides in from the other side; a swipe that falls short, or runs
 * past the first or last tab, springs back. Reduce Motion skips the slides
 * (Reanimated's default) but still changes tab.
 */

const TABS = ['/', '/syn', '/results', '/you'];

/** The next tab's entrance: which tab, and from which side (1 = from the right). */
let entering: { index: number; from: 1 | -1 } | null = null;
/** Each mounted tab's offset, so the next one is placed off to the side before it shows. */
const offsets = new Map<number, SharedValue<number>>();

const OUT_MS = 140;
const IN_MS = 280;
/** How far off to the side a tab starts its entrance, as a share of the width. */
const ENTER = 0.3;

const styles = StyleSheet.create({
    fill: { flex: 1 },
});

export const TabSwipe: FC<{ index: number; children: ReactNode }> = ({ index, children }) => {
    const { width } = useWindowDimensions();
    // A tab mounted by a swipe starts off to the side already.
    const x = useSharedValue(entering?.index === index ? entering.from * width * ENTER : 0);
    const hasPrevious = index > 0;
    const hasNext = index < TABS.length - 1;

    useEffect(() => {
        offsets.set(index, x);
        return () => {
            offsets.delete(index);
        };
    }, [index, x]);

    // Tabs stay mounted, so the entrance runs on focus rather than on mount;
    // a tab reached any other way (the tab bar) just sits at rest.
    useFocusEffect(
        useCallback(() => {
            x.set(
                entering?.index === index
                    ? withTiming(0, { duration: IN_MS, easing: Easing.out(Easing.cubic) })
                    : 0,
            );
            entering = null;
        }, [index, x]),
    );

    const go = useCallback(
        (step: 1 | -1) => {
            const next = index + step;
            entering = { index: next, from: step };
            const offset = offsets.get(next);
            offset?.set(step * width * ENTER);
            router.navigate(TABS[next] as Href);
        },
        [index, width],
    );

    const swipe = Gesture.Pan()
        .activeOffsetX([-25, 25])
        .failOffsetY([-15, 15])
        .onUpdate(({ translationX }) => {
            const open = translationX < 0 ? hasNext : hasPrevious;
            // Resistance past the first and last tab, so the edge is felt.
            x.set(translationX * (open ? 0.6 : 0.15));
        })
        .onEnd(({ translationX, velocityX }) => {
            const step = translationX < 0 ? 1 : -1;
            const open = step === 1 ? hasNext : hasPrevious;
            const far = Math.abs(translationX) >= 60 || Math.abs(velocityX) >= 500;

            if (!open || !far) {
                x.set(withSpring(0, { damping: 20, stiffness: 220 }));
                return;
            }

            x.set(
                withTiming(
                    -step * width * 0.35,
                    { duration: OUT_MS, easing: Easing.in(Easing.quad) },
                    (finished) => {
                        if (finished) runOnJS(go)(step);
                    },
                ),
            );
        });

    const slide = useAnimatedStyle(() => ({
        transform: [{ translateX: x.get() }],
        opacity: 1 - Math.min(Math.abs(x.get()) / width, 0.6),
    }));

    return (
        <GestureDetector gesture={swipe}>
            <Animated.View style={[styles.fill, slide]}>{children}</Animated.View>
        </GestureDetector>
    );
};
