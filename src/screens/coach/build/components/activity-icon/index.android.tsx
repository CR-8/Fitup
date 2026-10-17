import { FC } from 'react';
import {
    Accessibility,
    Activity as Pulse,
    BicepsFlexed,
    Bike,
    Dumbbell,
    Flower,
    Footprints,
    HeartPulse,
    type LucideIcon,
    Move,
    PersonStanding,
    Sprout,
    Zap,
} from 'lucide-react-native';

import type { Activity } from '../../plan';

/** An activity's glyph on Android, standing in for iOS's SF Symbol figures. */

const GLYPHS: Record<Activity, LucideIcon> = {
    fullBody: Dumbbell,
    upper: BicepsFlexed,
    lower: Footprints,
    core: PersonStanding,
    functional: Move,
    hiit: Zap,
    cardio: HeartPulse,
    running: Pulse,
    cycling: Bike,
    crossTraining: Accessibility,
    mobility: Flower,
    yoga: Sprout,
};

export const ActivityIcon: FC<{ activity: Activity; size: number; color: string }> = ({
    activity,
    size,
    color,
}) => {
    const Glyph = GLYPHS[activity];

    return <Glyph size={size} color={color} strokeWidth={1.75} />;
};
