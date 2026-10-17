import { FC } from 'react';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import type { MealSlot } from '@/db/schema';

/** A meal slot's SF Symbol. Android draws Lucide glyphs (`index.android.tsx`). */

const SYMBOLS: Record<MealSlot, SFSymbol> = {
    breakfast: 'sunrise',
    lunch: 'sun.max',
    dinner: 'moon.stars',
    snack: 'carrot',
};

export const MealIcon: FC<{ slot: MealSlot; size: number; color: string }> = ({
    slot,
    size,
    color,
}) => <SymbolView name={SYMBOLS[slot]} size={size} tintColor={color} />;
