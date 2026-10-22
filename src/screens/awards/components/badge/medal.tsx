import { FC, ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

import { UNEARNED } from './types';

/**
 * An award as a hexagonal medal, Today's and the share card's: an earned one
 * struck in the award's colour, lit from the top, with a glint or two; one not
 * yet earned is a dashed outline. The glyph is each platform's (see `Medal` in
 * `index.tsx` / `index.android.tsx`).
 */

const styles = StyleSheet.create({
    glyph: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

/** `hex` moved `amount` of the way to white (positive) or black (negative). */
const shade = (hex: string, amount: number): string => {
    const target = amount > 0 ? 255 : 0;
    const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

    return `#${channels
        .map((value) =>
            Math.round(value + (target - value) * Math.abs(amount))
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
};

/** A point-up hexagon around the centre. */
const hexagon = (c: number, r: number): string =>
    [-90, -30, 30, 90, 150, 210]
        .map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return `${c + r * Math.cos(rad)},${c + r * Math.sin(rad)}`;
        })
        .join(' ');

/** A four-point glint centred on (x, y). */
const glint = (x: number, y: number, r: number) =>
    `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

/** The glyph's colour on the medal: dark on a struck medal, grey on an outline. */
export const medalInk = (earned: boolean) => (earned ? 'rgba(8, 9, 11, 0.62)' : UNEARNED);

export const MedalFrame: FC<{
    color: string;
    earned: boolean;
    size: number;
    children: ReactNode;
}> = ({ color, earned, size, children }) => {
    const c = size / 2;
    const r = size * 0.42;
    const id = `medal-${color.replace('#', '')}`;

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                {earned ? (
                    <>
                        <Defs>
                            <LinearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={shade(color, 0.55)} />
                                <Stop offset="0.5" stopColor={color} />
                                <Stop offset="1" stopColor={shade(color, -0.35)} />
                            </LinearGradient>
                            <LinearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={shade(color, -0.15)} />
                                <Stop offset="1" stopColor={shade(color, 0.3)} />
                            </LinearGradient>
                        </Defs>
                        <Polygon
                            points={hexagon(c, r)}
                            fill={`url(#${id}-face)`}
                            stroke={shade(color, 0.6)}
                            strokeWidth={size * 0.02}
                            strokeLinejoin="round"
                        />
                        <Polygon
                            points={hexagon(c, r * 0.74)}
                            fill={`url(#${id}-inner)`}
                            stroke={shade(color, -0.25)}
                            strokeWidth={size * 0.012}
                            strokeLinejoin="round"
                        />
                        <G fill={shade(color, 0.7)}>
                            <Path d={glint(size * 0.08, size * 0.3, size * 0.05)} />
                            <Path d={glint(size * 0.92, size * 0.18, size * 0.04)} />
                            <Path d={glint(size * 0.9, size * 0.78, size * 0.035)} />
                        </G>
                    </>
                ) : (
                    <Polygon
                        points={hexagon(c, r)}
                        fill="none"
                        stroke={UNEARNED}
                        strokeWidth={Math.max(1.5, size * 0.018)}
                        strokeDasharray={`${size * 0.05} ${size * 0.04}`}
                        strokeLinejoin="round"
                    />
                )}
            </Svg>
            <View style={styles.glyph}>{children}</View>
        </View>
    );
};
