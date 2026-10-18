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

export { ProgressLine } from './frame';
