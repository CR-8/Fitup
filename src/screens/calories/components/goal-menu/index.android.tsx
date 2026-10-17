import { FC, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CalendarClock, CalendarCog, Diff } from 'lucide-react-native';

import { FrostedGlass } from '@/components/primitives/frosted-glass';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';

import type { GoalMenuProps } from './types';

/**
 * The ring's goal button on Android: a popover anchored under the button, as
 * iOS's SwiftUI menu is. Tapping outside closes it.
 */

const styles = StyleSheet.create((theme) => ({
    button: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.elevated,
    },
    backdrop: {
        flex: 1,
    },
    menu: {
        position: 'absolute',
        minWidth: 240,
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.xl,
    },
    item: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(4),
        paddingHorizontal: theme.space(4),
    },
    label: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
}));

export const GoalMenu: FC<GoalMenuProps> = ({ color, labels, onAdjustToday, onChangeDaily }) => {
    const { theme, rt } = useUnistyles();
    const anchor = useRef<View>(null);
    const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

    const open = () =>
        anchor.current?.measureInWindow((x, y, width, height) =>
            setPosition({ top: y + height + 8, right: rt.screen.width - (x + width) }),
        );

    const choose = (action: () => void) => () => {
        setPosition(null);
        action();
    };

    const items = [
        { key: 'today', label: labels.today, Icon: CalendarClock, onPress: onAdjustToday },
        { key: 'daily', label: labels.daily, Icon: CalendarCog, onPress: onChangeDaily },
    ];

    return (
        <>
            <View ref={anchor} collapsable={false}>
                <Pressable
                    style={styles.button}
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={labels.button}
                >
                    <Diff size={20} color={color} />
                </Pressable>
            </View>
            <Modal
                transparent
                visible={!!position}
                animationType="fade"
                onRequestClose={() => setPosition(null)}
            >
                <Pressable
                    style={styles.backdrop}
                    onPress={() => setPosition(null)}
                    animateOnPress={false}
                >
                    {position ? (
                        <FrostedGlass style={[styles.menu, position]}>
                            {items.map(({ key, label, Icon, onPress }) => (
                                <Pressable
                                    key={key}
                                    style={styles.item}
                                    onPress={choose(onPress)}
                                    accessibilityRole="menuitem"
                                >
                                    <Text style={styles.label}>{label}</Text>
                                    <Icon size={18} color={theme.colors.typography} />
                                </Pressable>
                            ))}
                        </FrostedGlass>
                    ) : null}
                </Pressable>
            </Modal>
        </>
    );
};
