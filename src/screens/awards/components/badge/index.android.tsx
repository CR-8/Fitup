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
import { MedalFrame, medalInk } from './medal';
import type { BadgeProps } from './types';

/** Award art on Android: the shared hexagonal medal around a Lucide glyph. */

const SYMBOLS: Record<AwardSymbol, LucideIcon> = {
    flame: Flame,
    target: Crosshair,
    drop: Droplet,
    dumbbell: Dumbbell,
    trophy: Trophy,
    calendar: CalendarCheck,
    bolt: Zap,
};

/** An award as a hexagonal medal: Today, the awards screens and the share card. */
export const Medal: FC<Omit<BadgeProps, 'shape'>> = ({ symbol, ...frame }) => {
    const Glyph = SYMBOLS[symbol];

    return (
        <MedalFrame {...frame}>
            <Glyph size={frame.size * 0.3} color={medalInk(frame.earned)} strokeWidth={2} />
        </MedalFrame>
    );
};

export { ProgressLine } from './frame';
