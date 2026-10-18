import { FC } from 'react';
import Svg, { Circle } from 'react-native-svg';

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
