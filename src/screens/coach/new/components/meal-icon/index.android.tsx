import { FC } from 'react';
import { Carrot, type LucideIcon, Moon, Sun, Sunrise } from 'lucide-react-native';

import type { MealSlot } from '@/db/schema';

/** A meal slot's glyph on Android, standing in for iOS's SF Symbols. */

const GLYPHS: Record<MealSlot, LucideIcon> = {
    breakfast: Sunrise,
    lunch: Sun,
    dinner: Moon,
    snack: Carrot,
};

export const MealIcon: FC<{ slot: MealSlot; size: number; color: string }> = ({
    slot,
    size,
    color,
}) => {
    const Glyph = GLYPHS[slot];

    return <Glyph size={size} color={color} strokeWidth={1.75} />;
};
