import { FC } from 'react';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import type { AwardSymbol } from '../../data';
import { MedalFrame, medalInk } from './medal';
import type { BadgeProps } from './types';

/** Award art on iOS: the shared hexagonal medal around an SF Symbol. Android: `index.android.tsx`. */

const SYMBOLS: Record<AwardSymbol, SFSymbol> = {
    flame: 'flame',
    target: 'scope',
    drop: 'drop',
    dumbbell: 'dumbbell',
    trophy: 'trophy',
    calendar: 'calendar',
    bolt: 'bolt',
};

/** An award as a hexagonal medal: Today, the awards screens and the share card. */
export const Medal: FC<Omit<BadgeProps, 'shape'>> = ({ symbol, ...frame }) => (
    <MedalFrame {...frame}>
        <SymbolView
            name={SYMBOLS[symbol]}
            size={frame.size * 0.3}
            tintColor={medalInk(frame.earned)}
        />
    </MedalFrame>
);

export { ProgressLine } from './frame';
