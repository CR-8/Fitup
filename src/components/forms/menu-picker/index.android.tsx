import { useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Check, ChevronsUpDown } from 'lucide-react-native';

import { FrostedGlass } from '@/components/primitives/frosted-glass';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';

import type { MenuPickerProps } from './types';

/**
 * "30min ⌃" on Android: the current choice with an up-down chevron, opening a
 * glass list anchored to it with a check on the current one, as iOS's menu does.
 */

const styles = StyleSheet.create((theme) => ({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(1),
        minHeight: 32,
    },
    value: (color: string) => ({
        ...theme.fontSize.default,
        color,
    }),
    backdrop: {
        flex: 1,
    },
    menu: {
        position: 'absolute',
        minWidth: 220,
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.xl,
    },
    item: {
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
    },
    check: {
        width: 16,
    },
    label: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
}));

export function MenuPicker<T extends string | number>({
    value,
    options,
    onChange,
    accessibilityLabel,
    color = '#9a9fa8',
}: MenuPickerProps<T>) {
    const { theme, rt } = useUnistyles();
    const anchor = useRef<View>(null);
    const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
    const current = options.find((option) => option.value === value);

    const open = () =>
        anchor.current?.measureInWindow((x, y, width, height) => {
            // Opens upward when the list would run off the bottom of the screen.
            const listHeight = options.length * 46 + 8;
            const below = y + height + 6;
            setPosition({
                top:
                    below + listHeight > rt.screen.height - 24
                        ? Math.max(24, y - listHeight - 6)
                        : below,
                right: rt.screen.width - (x + width),
            });
        });

    return (
        <>
            <View ref={anchor} collapsable={false}>
                <Pressable
                    style={styles.button}
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={`${accessibilityLabel}, ${current?.label ?? ''}`}
                >
                    <Text style={styles.value(color)}>{current?.label}</Text>
                    <ChevronsUpDown size={14} color={color} />
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
                            {options.map((option) => (
                                <Pressable
                                    key={String(option.value)}
                                    style={styles.item}
                                    onPress={() => {
                                        setPosition(null);
                                        onChange(option.value);
                                    }}
                                    accessibilityRole="menuitem"
                                    accessibilityState={{ selected: option.value === value }}
                                >
                                    <View style={styles.check}>
                                        {option.value === value ? (
                                            <Check size={16} color={theme.colors.typography} />
                                        ) : null}
                                    </View>
                                    <Text style={styles.label}>{option.label}</Text>
                                </Pressable>
                            ))}
                        </FrostedGlass>
                    ) : null}
                </Pressable>
            </Modal>
        </>
    );
}
