import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';

/**
 * Every icon the app draws, as an SF Symbol on iOS and a Material Symbol on
 * Android, so each platform shows its own iconography.
 */
export const icons = {
    'arrow-right': { ios: 'arrow.right', android: 'arrow_forward' },
    'arrow-up': { ios: 'arrow.up', android: 'arrow_upward' },
    'bar-chart': { ios: 'chart.bar', android: 'bar_chart' },
    bell: { ios: 'bell', android: 'notifications' },
    check: { ios: 'checkmark', android: 'check' },
    'chevron-down': { ios: 'chevron.down', android: 'expand_more' },
    'chevron-left': { ios: 'chevron.left', android: 'chevron_left' },
    'chevron-right': { ios: 'chevron.right', android: 'chevron_right' },
    'chevron-up': { ios: 'chevron.up', android: 'expand_less' },
    'chevrons-up': { ios: 'chevron.up.2', android: 'keyboard_double_arrow_up' },
    'chevrons-up-down': { ios: 'chevron.up.chevron.down', android: 'unfold_more' },
    clock: { ios: 'clock', android: 'schedule' },
    dumbbell: { ios: 'dumbbell', android: 'fitness_center' },
    ellipsis: { ios: 'ellipsis', android: 'more_vert' },
    filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list' },
    flame: { ios: 'flame', android: 'local_fire_department' },
    fruit: { ios: 'carrot', android: 'nutrition' },
    heart: { ios: 'heart', android: 'favorite' },
    'heart-fill': { ios: 'heart.fill', android: 'favorite' },
    key: { ios: 'key', android: 'key' },
    language: { ios: 'globe', android: 'language' },
    lock: { ios: 'lock', android: 'lock' },
    mail: { ios: 'envelope', android: 'mail' },
    megaphone: { ios: 'megaphone', android: 'campaign' },
    message: { ios: 'bubble.left', android: 'chat_bubble' },
    minus: { ios: 'minus', android: 'remove' },
    pause: { ios: 'pause.fill', android: 'pause' },
    person: { ios: 'person', android: 'person' },
    'person-circle': { ios: 'person.crop.circle', android: 'account_circle' },
    play: { ios: 'play.fill', android: 'play_arrow' },
    plus: { ios: 'plus', android: 'add' },
    ruler: { ios: 'ruler', android: 'straighten' },
    salad: { ios: 'leaf', android: 'eco' },
    scale: { ios: 'scalemass', android: 'monitor_weight' },
    settings: { ios: 'gearshape', android: 'settings' },
    'skip-forward': { ios: 'forward.end.fill', android: 'skip_next' },
    sparkles: { ios: 'sparkles', android: 'auto_awesome' },
    star: { ios: 'star', android: 'star' },
    stop: { ios: 'stop.fill', android: 'stop' },
    appearance: { ios: 'circle.lefthalf.filled', android: 'contrast' },
    target: { ios: 'target', android: 'target' },
    timer: { ios: 'timer', android: 'timer' },
    trash: { ios: 'trash', android: 'delete' },
    'trending-up': { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' },
    trophy: { ios: 'trophy', android: 'emoji_events' },
    undo: { ios: 'arrow.uturn.backward', android: 'undo' },
    utensils: { ios: 'fork.knife', android: 'restaurant' },
    'volume-high': { ios: 'speaker.wave.2', android: 'volume_up' },
    'volume-low': { ios: 'speaker.wave.1', android: 'volume_down' },
    x: { ios: 'xmark', android: 'close' },
} satisfies Record<string, Extract<SymbolViewProps['name'], object>>;

export type IconName = keyof typeof icons;

export interface IconProps {
    name: IconName;
    size?: number;
    color?: ColorValue;
    style?: StyleProp<ViewStyle>;
}
