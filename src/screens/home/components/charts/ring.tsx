import { FC } from 'react';
import Svg, { Circle, G } from 'react-native-svg';

import type { RingProps } from './types';

/**
 * An Apple-style activity ring, drawn as vector on both platforms: a track in
 * the ring's own colour, dimmed, and the progress over it with round caps.
 *
 * Shared rather than native on iOS: SwiftUI's capacity gauge only comes at
 * widget size, and scaled up inside a host it did not draw at all.
 */
export const Ring: FC<RingProps> = ({ progress, color, size }) => {
    const stroke = size * 0.11;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const filled = Math.min(Math.max(progress, 0), 1);

    return (
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={`${color}33`}
                strokeWidth={stroke}
                fill="none"
            />
            {filled > 0 ? (
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={circumference * (1 - filled)}
                    strokeLinecap="round"
                    fill="none"
                />
            ) : null}
        </Svg>
    );
};

/**
 * Several rings, one inside the other, Apple's Activity rings: the first is
 * the outermost. Today's dial, the activity screen and its calendar all draw
 * them; the stroke defaults to a tenth of the size.
 */
export const Rings: FC<{
    rings: { progress: number; color: string }[];
    size: number;
    stroke?: number;
    gap?: number;
}> = ({ rings, size, stroke = size * 0.1, gap = stroke * 0.25 }) => (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {rings.map((ring, i) => {
            const radius = (size - stroke) / 2 - i * (stroke + gap);
            const circumference = 2 * Math.PI * radius;
            const filled = Math.min(Math.max(ring.progress, 0), 1);

            return (
                <G key={i}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={`${ring.color}33`}
                        strokeWidth={stroke}
                        fill="none"
                    />
                    {filled > 0 ? (
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke={ring.color}
                            strokeWidth={stroke}
                            strokeDasharray={`${circumference} ${circumference}`}
                            strokeDashoffset={circumference * (1 - filled)}
                            strokeLinecap="round"
                            fill="none"
                        />
                    ) : null}
                </G>
            );
        })}
    </Svg>
);
