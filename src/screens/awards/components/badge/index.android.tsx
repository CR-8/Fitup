import { FC } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';
import {
    CalendarCheck,
    Crosshair,
    Droplet,
    Dumbbell,
    Flame,
    type LucideIcon,
    Trophy,
    Zap,
} from 'lucide-react-native';

import type { AwardSymbol } from '../../data';
import { UNEARNED, type BadgeProps, type ProgressLineProps } from './types';

/**
 * Award art on Android, drawn in SVG: the same nested outlines and centred
 * glyph iOS draws in SwiftUI.
 */

const SYMBOLS: Record<AwardSymbol, LucideIcon> = {
    flame: Flame,
    target: Crosshair,
    drop: Droplet,
    dumbbell: Dumbbell,
    trophy: Trophy,
    calendar: CalendarCheck,
    bolt: Zap,
};

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

export const Badge: FC<BadgeProps> = ({ shape, symbol, color, earned, size }) => {
    const ink = earned ? color : UNEARNED;
    const line = Math.max(2, size * 0.03);
    const scale = shape === 'diamond' ? 0.7 : 1;
    const Glyph = SYMBOLS[symbol];
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
            <View style={styles.glyph}>
                <Glyph size={size * 0.26} color={ink} strokeWidth={1.75} />
            </View>
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
