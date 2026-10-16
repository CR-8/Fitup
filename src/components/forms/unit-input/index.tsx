import { useState } from 'react';
import { TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { SegmentedTabs } from '@/components/forms/segmented-tabs';

const styles = StyleSheet.create((theme) => ({
    row: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    field: {
        flex: 1,
        minHeight: theme.space(12),
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.space(4),
        color: theme.colors.typography,
        ...theme.fontSize.default,
    },
    error: {
        ...theme.fontSize.sm,
        color: theme.colors.destructive,
    },
}));

type UnitInputProps<U extends string> = {
    /** The value in the caller's canonical unit (kg, cm), or null when blank. */
    value: number | null | undefined;
    units: readonly { value: U; title: string }[];
    unit: U;
    onUnitChange: (unit: U) => void;
    /** Canonical → shown, and shown → canonical, e.g. kg ⇄ lb. */
    toDisplay: (value: number, unit: U) => number;
    fromDisplay: (value: number, unit: U) => number;
    onChange: (value: number | null) => void;
    placeholder?: string;
    error?: string;
    accessibilityLabel: string;
};

const format = (value: number): string => String(Math.round(value * 10) / 10);

/**
 * A number with a unit toggle beside it, for body measurements. The field keeps
 * its own text while you type and reports a canonical number; changing the unit
 * re-reads that number in the new one, so toggling never changes the value.
 */
export function UnitInput<U extends string>({
    value,
    units,
    unit,
    onUnitChange,
    toDisplay,
    fromDisplay,
    onChange,
    placeholder,
    error,
    accessibilityLabel,
}: UnitInputProps<U>) {
    const { theme } = useUnistyles();
    const [text, setText] = useState(value == null ? '' : format(toDisplay(value, unit)));

    const handleUnit = (next: U) => {
        // Re-express the current number in the new unit rather than reinterpreting the text.
        setText(value == null ? '' : format(toDisplay(value, next)));
        onUnitChange(next);
    };

    return (
        <VStack style={{ gap: theme.space(2) }}>
            <HStack style={styles.row}>
                <TextInput
                    style={styles.field}
                    value={text}
                    onChangeText={(next) => {
                        setText(next);
                        const parsed = parseFloat(next.replace(',', '.'));
                        onChange(Number.isFinite(parsed) ? fromDisplay(parsed, unit) : null);
                    }}
                    keyboardType="decimal-pad"
                    placeholder={placeholder}
                    placeholderTextColor={theme.colors.mutedTypography as string}
                    accessibilityLabel={accessibilityLabel}
                    selectionColor={theme.colors.brand[500] as string}
                />
                <SegmentedTabs compact segments={units} value={unit} onChange={handleUnit} />
            </HStack>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </VStack>
    );
}
