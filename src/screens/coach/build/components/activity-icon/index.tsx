import { FC } from 'react';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import type { Activity } from '../../plan';

/** An activity's SF Symbol figure. Android draws Lucide glyphs (`index.android.tsx`). */

const SYMBOLS: Record<Activity, SFSymbol> = {
    fullBody: 'figure.strengthtraining.traditional',
    upper: 'figure.arms.open',
    lower: 'figure.step.training',
    core: 'figure.core.training',
    functional: 'figure.strengthtraining.functional',
    hiit: 'figure.highintensity.intervaltraining',
    cardio: 'figure.mixed.cardio',
    running: 'figure.run',
    cycling: 'figure.indoor.cycle',
    crossTraining: 'figure.cross.training',
    mobility: 'figure.flexibility',
    yoga: 'figure.yoga',
};

export const ActivityIcon: FC<{ activity: Activity; size: number; color: string }> = ({
    activity,
    size,
    color,
}) => <SymbolView name={SYMBOLS[activity]} size={size} tintColor={color} />;
