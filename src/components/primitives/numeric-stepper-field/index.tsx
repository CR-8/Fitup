import { FC, useCallback, useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';

type NumericStepperFieldProps = {
    value: number;
    unit: string;
    onChange: (value: number) => void;
    /** Read out as the field's accessibility label. */
    modalTitle?: string;
    step?: number;
    min?: number;
    max?: number;
    decimalPlaces?: number;
    /**
     * Smaller buttons and value, for two side by side — the workout timer's
     * weight and reps.
     */
    compact?: boolean;
};

const styles = StyleSheet.create((theme) => ({
    container: (compact: boolean) => ({
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: compact ? theme.space(2) : theme.space(3),
    }),
    actionButton: (disabled: boolean, compact: boolean) => ({
        width: compact ? theme.space(10) : theme.space(12),
        height: compact ? theme.space(10) : theme.space(12),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.elevated,
        opacity: disabled ? 0.45 : 1,
    }),
    value: {
        flex: 1,
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: theme.space(1),
    },
    // Alone (no unit beside it) the value takes the whole gap between the
    // buttons: at its minimum width alone, "12.5" was cut to "12.".
    input: (compact: boolean, fill: boolean) => ({
        ...(compact ? theme.fontSize['2xl'] : theme.fontSize['4xl']),
        ...theme.typography.metric,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center' as const,
        minWidth: theme.space(10),
        flexGrow: fill ? 1 : 0,
        flexShrink: 1,
        padding: 0,
    }),
    unit: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
}));

const toFixedNumber = (value: number, decimalPlaces: number): number => {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max?: number): number => {
    const upper = max ?? Number.POSITIVE_INFINITY;
    return Math.max(min, Math.min(upper, value));
};

const parseNumericDraft = (draft: string): number | null => {
    if (draft.trim().length === 0) return null;
    const normalized = draft.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const formatEditableValue = (value: number, decimalPlaces: number): string => {
    const fixed = toFixedNumber(value, decimalPlaces).toFixed(decimalPlaces);
    const trimmed = fixed.replace(/\.?0+$/, '');
    return trimmed.length > 0 ? trimmed : '0';
};

const formatDisplayValue = (value: number, decimalPlaces: number): string => {
    const normalized = toFixedNumber(value, decimalPlaces);
    const hasFraction = Math.abs(normalized % 1) > 0;

    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: hasFraction ? 1 : 0,
        maximumFractionDigits: decimalPlaces,
    }).format(normalized);
};

const normalizeValue = (
    value: number,
    min: number,
    max: number | undefined,
    decimalPlaces: number,
): number => {
    return toFixedNumber(clamp(value, min, max), decimalPlaces);
};

/** − value + : the value itself is typed straight into, on a decimal pad. */
const NumericStepperField: FC<NumericStepperFieldProps> = ({
    value,
    unit,
    onChange,
    modalTitle,
    step = 0.1,
    min = 0,
    max,
    decimalPlaces = 1,
    compact = false,
}) => {
    const { theme } = useUnistyles();

    const safeValue = useMemo(
        () => normalizeValue(Number.isFinite(value) ? value : min, min, max, decimalPlaces),
        [decimalPlaces, max, min, value],
    );

    const [draft, setDraft] = useState<string | null>(null);

    const canDecrement = safeValue > min;
    const canIncrement = max == null || safeValue < max;

    const commit = useCallback(() => {
        if (draft == null) return;
        onChange(normalizeValue(parseNumericDraft(draft) ?? 0, min, max, decimalPlaces));
        setDraft(null);
    }, [decimalPlaces, draft, max, min, onChange]);

    const handleStepDown = useCallback(() => {
        if (!canDecrement) return;
        onChange(normalizeValue(safeValue - step, min, max, decimalPlaces));
    }, [canDecrement, decimalPlaces, max, min, onChange, safeValue, step]);

    const handleStepUp = useCallback(() => {
        if (!canIncrement) return;
        onChange(normalizeValue(safeValue + step, min, max, decimalPlaces));
    }, [canIncrement, decimalPlaces, max, min, onChange, safeValue, step]);

    return (
        <HStack style={styles.container(compact)}>
            <Pressable
                onPress={handleStepDown}
                disabled={!canDecrement}
                style={styles.actionButton(!canDecrement, compact)}
            >
                <Icon name="minus" size={compact ? 18 : 22} color={theme.colors.typography} />
            </Pressable>

            <HStack style={styles.value}>
                <TextInput
                    accessibilityLabel={modalTitle}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    style={styles.input(compact, !unit)}
                    value={draft ?? formatDisplayValue(safeValue, decimalPlaces)}
                    onFocus={() => setDraft(formatEditableValue(safeValue, decimalPlaces))}
                    onChangeText={(text) => setDraft(text.replace(/[^0-9.,]/g, ''))}
                    onBlur={commit}
                    onSubmitEditing={commit}
                />
                {unit ? <Text style={styles.unit}>{unit}</Text> : null}
            </HStack>

            <Pressable
                onPress={handleStepUp}
                disabled={!canIncrement}
                style={styles.actionButton(!canIncrement, compact)}
            >
                <Icon name="plus" size={compact ? 18 : 22} color={theme.colors.typography} />
            </Pressable>
        </HStack>
    );
};

export { NumericStepperField };
