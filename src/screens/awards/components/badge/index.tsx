import { FC } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Circle, Host, Image, ProgressView, RoundedRectangle, ZStack } from '@expo/ui/swift-ui';
import {
    foregroundStyle,
    frame,
    rotationEffect,
    strokeBorder,
    tint,
} from '@expo/ui/swift-ui/modifiers';

import type { AwardSymbol } from '../../data';
import { UNEARNED, type BadgeProps, type ProgressLineProps } from './types';

/**
 * Award art on iOS, drawn in SwiftUI: two nested outlines in the award's shape
 * around an SF Symbol. Android draws the same in SVG (`index.android.tsx`).
 */

const SYMBOLS: Record<AwardSymbol, SFSymbol> = {
    flame: 'flame',
    target: 'scope',
    drop: 'drop',
    dumbbell: 'dumbbell',
    trophy: 'trophy',
    calendar: 'calendar',
    bolt: 'bolt',
};

export const Badge: FC<BadgeProps> = ({ shape, symbol, color, earned, size }) => {
    const ink = earned ? color : UNEARNED;
    const line = { lineWidth: Math.max(2, size * 0.03) };
    // A diamond is a rounded square turned 45°, so it is drawn smaller to fit.
    const scale = shape === 'diamond' ? 0.7 : 1;

    const outline = (fraction: number, filled: boolean) => {
        const side = size * scale * fraction;
        const modifiers = [
            foregroundStyle(filled && earned ? `${color}26` : 'transparent'),
            frame({ width: side, height: side }),
            strokeBorder(
                shape === 'circle'
                    ? { content: ink, style: line, shape: 'circle' }
                    : {
                          content: ink,
                          style: line,
                          shape: 'roundedRectangle',
                          cornerRadius: side * 0.24,
                      },
            ),
            ...(shape === 'diamond' ? [rotationEffect(45)] : []),
        ];

        return shape === 'circle' ? (
            <Circle modifiers={modifiers} />
        ) : (
            <RoundedRectangle cornerRadius={side * 0.24} modifiers={modifiers} />
        );
    };

    return (
        <Host style={{ width: size, height: size }}>
            <ZStack>
                {outline(1, true)}
                {outline(0.74, false)}
                <Image systemName={SYMBOLS[symbol]} size={size * 0.26} color={ink} />
            </ZStack>
        </Host>
    );
};

export const ProgressLine: FC<ProgressLineProps> = ({ progress, color }) => (
    <Host matchContents={{ vertical: true }}>
        <ProgressView value={Math.min(Math.max(progress, 0), 1)} modifiers={[tint(color)]} />
    </Host>
);
