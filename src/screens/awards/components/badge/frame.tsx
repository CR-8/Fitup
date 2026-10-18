import { FC, ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

import { UNEARNED, type BadgeProps, type ProgressLineProps } from './types';

/**
 * Award art shared by both platforms: two nested outlines in the award's shape,
 * drawn as vector, around a glyph each platform supplies (an SF Symbol on iOS,
 * a Lucide glyph on Android). As SwiftUI shapes they painted outside their
 * frame, over the card's title.
 */

const styles = StyleSheet.create((theme) => ({
    glyph: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    track: {
        height: 6,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.neutral[700],
        overflow: 'hidden',
    },
}));

export const BadgeFrame: FC<Omit<BadgeProps, 'symbol'> & { children: ReactNode }> = ({
    shape,
    color,
    earned,
    size,
    children,
}) => {
    const ink = earned ? color : UNEARNED;
    const line = Math.max(2, size * 0.03);
    // A diamond is a rounded square turned 45 degrees, so it is drawn smaller to fit.
    const scale = shape === 'diamond' ? 0.7 : 1;
    const c = size / 2;

    const outline = (fraction: number, filled: boolean) => {
        const side = size * scale * fraction - line;
        const fill = filled && earned ? `${color}26` : 'none';

        return shape === 'circle' ? (
            <Circle cx={c} cy={c} r={side / 2} stroke={ink} strokeWidth={line} fill={fill} />
        ) : (
            <Rect
                x={c - side / 2}
                y={c - side / 2}
                width={side}
                height={side}
                rx={side * 0.24}
                stroke={ink}
                strokeWidth={line}
                fill={fill}
                transform={shape === 'diamond' ? `rotate(45 ${c} ${c})` : undefined}
            />
        );
    };

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                {outline(1, true)}
                {outline(0.74, false)}
            </Svg>
            <View style={styles.glyph}>{children}</View>
        </View>
    );
};

export const ProgressLine: FC<ProgressLineProps> = ({ progress, color }) => (
    <View style={styles.track}>
        <View
            style={{
                width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
                minWidth: 6,
                height: '100%',
                borderRadius: 3,
                backgroundColor: color,
            }}
        />
    </View>
);
