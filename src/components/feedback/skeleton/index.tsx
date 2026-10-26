import { FC, useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { VStack } from '@/components/primitives/vstack';

/**
 * A grey block that breathes where content is still loading, so a screen
 * keeps its shape instead of jumping from a spinner to a layout. Reduce Motion
 * holds it still (Reanimated's default).
 */

const styles = StyleSheet.create((theme) => ({
    block: {
        backgroundColor: theme.colors.elevated,
        borderCurve: 'continuous',
    },
    card: {
        padding: theme.space(4),
        gap: theme.space(3),
        borderRadius: theme.radius['3xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
    },
    list: {
        gap: theme.space(3),
    },
}));

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    radius?: number;
    style?: StyleProp<ViewStyle>;
}

export const Skeleton: FC<SkeletonProps> = ({ width = '100%', height = 16, radius = 8, style }) => {
    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.set(
            withRepeat(
                withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.quad) }),
                -1,
                true,
            ),
        );
    }, [opacity]);

    const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

    return (
        <Animated.View
            style={[styles.block, { width, height, borderRadius: radius }, pulse, style]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        />
    );
};

/** A card's worth of placeholder: a title line and a few shorter ones. */
export const SkeletonCard: FC<{ lines?: number; style?: StyleProp<ViewStyle> }> = ({
    lines = 2,
    style,
}) => (
    <VStack style={[styles.card, style]}>
        <Skeleton width="55%" height={18} />
        {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} width={i === lines - 1 ? '35%' : '85%'} height={12} />
        ))}
    </VStack>
);

/** A stack of placeholder cards, for a list that has not loaded yet. */
export const SkeletonList: FC<{ count?: number; lines?: number; style?: StyleProp<ViewStyle> }> = ({
    count = 4,
    lines,
    style,
}) => (
    <VStack style={[styles.list, style]}>
        {Array.from({ length: count }, (_, i) => (
            <SkeletonCard key={i} lines={lines} />
        ))}
    </VStack>
);
