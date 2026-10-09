import { FC, ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import Svg, { Circle } from 'react-native-svg';
import Reanimated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { Box } from '@/components/primitives/box';

/**
 * One ratio against a target, drawn as a ring: a meter bent into a circle.
 *
 * The track is the fill's own hue at low opacity rather than a neutral grey, so
 * an empty ring still says which measure it is and the unfilled part reads as
 * "still to go" rather than as a different thing. Whatever is passed as
 * `children` sits in the middle — the figure itself, in text colour; the ring
 * carries the colour, the words never do.
 */

interface ProgressRingProps {
    /** 0 to 1. Clamped, so overshooting a target draws a full ring, not a second lap. */
    progress: number;
    /** A plain colour string: SVG cannot take a PlatformColor. */
    color: string;
    size?: number;
    strokeWidth?: number;
    children?: ReactNode;
    accessibilityLabel?: string;
}

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

const TRACK_OPACITY = 0.18;

const styles = StyleSheet.create({
    container: (size: number) => ({
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    svg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
});

export const ProgressRing: FC<ProgressRingProps> = ({
    progress,
    color,
    size = 72,
    strokeWidth = 8,
    children,
    accessibilityLabel,
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));

    // Fills rather than jumps, so a session finished or a plan applied reads as
    // the week moving forward.
    const fill = useSharedValue(0);
    useEffect(() => {
        fill.set(withTiming(clamped, { duration: 600 }));
    }, [clamped, fill]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - fill.get()),
    }));

    return (
        <Box
            style={styles.container(size)}
            accessible={!!accessibilityLabel}
            accessibilityRole="progressbar"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        >
            <Svg width={size} height={size} style={styles.svg}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeOpacity={TRACK_OPACITY}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Nothing drawn at zero: a round cap on an empty arc is a dot
                    that reads as "a little done". */}
                {clamped > 0 ? (
                    <AnimatedCircle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference} ${circumference}`}
                        animatedProps={animatedProps}
                        fill="none"
                        // Start at twelve o'clock and run clockwise.
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                ) : null}
            </Svg>
            {children}
        </Box>
    );
};
