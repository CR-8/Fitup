import type { ColorValue } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';

/**
 * A wrap of pill choices. Selection is an outline in the accent with a soft
 * fill, as the reference's day and activity pickers draw it; the state never
 * relies on colour alone (screen readers get radio / checkbox state).
 */

const styles = StyleSheet.create((theme) => ({
    row: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    chip: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius.full,
        // Filled grey pills, as the reference's pickers; the border is there
        // (transparent) so selecting one never shifts the row.
        borderWidth: 1.5,
        borderColor: 'transparent',
        backgroundColor: theme.colors.elevated,
    },
    label: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    },
}));

export interface ChoiceOption<T extends string | number> {
    value: T;
    label: string;
}

interface ChoiceChipsProps<T extends string | number> {
    options: ChoiceOption<T>[];
    selected: readonly T[];
    onToggle: (value: T) => void;
    /** Checkboxes rather than radios, for screen readers. */
    multiple?: boolean;
    color?: ColorValue;
    softColor?: ColorValue;
}

export const ChoiceChips = <T extends string | number>({
    options,
    selected,
    onToggle,
    multiple = false,
    color,
    softColor,
}: ChoiceChipsProps<T>) => {
    const { theme } = useUnistyles();

    return (
        <HStack style={styles.row} accessibilityRole={multiple ? undefined : 'radiogroup'}>
            {options.map((option) => {
                const isSelected = selected.includes(option.value);

                return (
                    <Pressable
                        key={String(option.value)}
                        style={[
                            styles.chip,
                            isSelected && {
                                borderColor: color ?? theme.colors.primary,
                                backgroundColor: softColor ?? theme.colors.primarySoft,
                            },
                        ]}
                        onPress={() => onToggle(option.value)}
                        accessibilityRole={multiple ? 'checkbox' : 'radio'}
                        accessibilityState={
                            multiple ? { checked: isSelected } : { selected: isSelected }
                        }
                    >
                        <Text style={styles.label}>{option.label}</Text>
                    </Pressable>
                );
            })}
        </HStack>
    );
};
