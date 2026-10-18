import { FC } from 'react';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import type { AwardSymbol } from '../../data';
import { BadgeFrame } from './frame';
import { UNEARNED, type BadgeProps } from './types';

/** Award art on iOS: the shared vector frame around an SF Symbol. Android: `index.android.tsx`. */

const SYMBOLS: Record<AwardSymbol, SFSymbol> = {
    flame: 'flame',
    target: 'scope',
    drop: 'drop',
    dumbbell: 'dumbbell',
    trophy: 'trophy',
    calendar: 'calendar',
    bolt: 'bolt',
};

export const Badge: FC<BadgeProps> = ({ symbol, ...frame }) => (
    <BadgeFrame {...frame}>
        <SymbolView
            name={SYMBOLS[symbol]}
            size={frame.size * 0.26}
            tintColor={frame.earned ? frame.color : UNEARNED}
        />
    </BadgeFrame>
);

export { ProgressLine } from './frame';
