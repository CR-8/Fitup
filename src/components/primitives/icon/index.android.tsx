import { FC } from 'react';
import { useUnistyles } from 'react-native-unistyles';
import {
    Apple,
    ArrowRight,
    ArrowUp,
    BarChart3,
    Bell,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsUp,
    ChevronsUpDown,
    ChevronUp,
    Circle,
    CircleCheck,
    CircleUser,
    Clock,
    Droplet,
    Dumbbell,
    Ellipsis,
    Flame,
    Heart,
    House,
    KeyRound,
    Languages,
    ListFilter,
    Lock,
    type LucideIcon,
    Mail,
    Megaphone,
    MessageCircle,
    Minus,
    Pause,
    Play,
    Plus,
    Ruler,
    Salad,
    Scale,
    Settings,
    SkipForward,
    Sparkles,
    Square,
    Star,
    SunMoon,
    Target,
    Timer,
    Share,
    Trash2,
    TrendingUp,
    Trophy,
    Undo2,
    User,
    UtensilsCrossed,
    Volume1,
    Volume2,
    X,
} from 'lucide-react-native';

import type { IconName, IconProps } from '@/theme/icons';

export type { IconName, IconProps };

/** Android keeps the pre-native UI's Lucide set; iOS draws SF Symbols. */
const icons: Record<IconName, LucideIcon> = {
    'arrow-right': ArrowRight,
    'arrow-up': ArrowUp,
    'bar-chart': BarChart3,
    bell: Bell,
    apple: Apple,
    calendar: CalendarDays,
    check: Check,
    'check-circle': CircleCheck,
    circle: Circle,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'chevron-up': ChevronUp,
    'chevrons-up': ChevronsUp,
    'chevrons-up-down': ChevronsUpDown,
    clock: Clock,
    droplet: Droplet,
    dumbbell: Dumbbell,
    ellipsis: Ellipsis,
    filter: ListFilter,
    flame: Flame,
    fruit: Apple,
    heart: Heart,
    'heart-fill': Heart,
    key: KeyRound,
    language: Languages,
    lock: Lock,
    mail: Mail,
    megaphone: Megaphone,
    message: MessageCircle,
    minus: Minus,
    pause: Pause,
    person: User,
    'person-circle': CircleUser,
    play: Play,
    plus: Plus,
    ruler: Ruler,
    salad: Salad,
    scale: Scale,
    settings: Settings,
    sparkles: Sparkles,
    'skip-forward': SkipForward,
    star: Star,
    stop: Square,
    appearance: SunMoon,
    target: Target,
    timer: Timer,
    share: Share,
    trash: Trash2,
    'trending-up': TrendingUp,
    home: House,
    trophy: Trophy,
    undo: Undo2,
    utensils: UtensilsCrossed,
    'volume-high': Volume2,
    'volume-low': Volume1,
    x: X,
};

/** Glyphs that are solid on iOS (`*.fill` symbols) are filled here too. */
const FILLED = new Set<IconName>([
    'droplet',
    'heart-fill',
    'pause',
    'play',
    'stop',
    'skip-forward',
]);

export const Icon: FC<IconProps> = ({ name, size = 20, color, style }) => {
    const { theme } = useUnistyles();
    const Glyph = icons[name];
    // Android's theme colours are plain strings; only iOS uses PlatformColor.
    const tint = (color ?? theme.colors.typography) as string;

    return (
        <Glyph
            size={size}
            color={tint}
            fill={FILLED.has(name) ? tint : 'transparent'}
            strokeWidth={2}
            style={style}
        />
    );
};
