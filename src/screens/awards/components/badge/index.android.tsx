import { FC } from 'react';
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
import { BadgeFrame } from './frame';
import { MedalFrame, medalInk } from './medal';
import { UNEARNED, type BadgeProps } from './types';

/** Award art on Android: the shared vector frame around a Lucide glyph. */

const SYMBOLS: Record<AwardSymbol, LucideIcon> = {
    flame: Flame,
    target: Crosshair,
    drop: Droplet,
    dumbbell: Dumbbell,
    trophy: Trophy,
    calendar: CalendarCheck,
    bolt: Zap,
};

export const Badge: FC<BadgeProps> = ({ symbol, ...frame }) => {
    const Glyph = SYMBOLS[symbol];

    return (
        <BadgeFrame {...frame}>
            <Glyph
                size={frame.size * 0.26}
                color={frame.earned ? frame.color : UNEARNED}
                strokeWidth={1.75}
            />
        </BadgeFrame>
    );
};

/** The same award as a hexagonal medal, for Today and the share card. */
export const Medal: FC<Omit<BadgeProps, 'shape'>> = ({ symbol, ...frame }) => {
    const Glyph = SYMBOLS[symbol];

    return (
        <MedalFrame {...frame}>
            <Glyph size={frame.size * 0.3} color={medalInk(frame.earned)} strokeWidth={2} />
        </MedalFrame>
    );
};

export { ProgressLine } from './frame';
