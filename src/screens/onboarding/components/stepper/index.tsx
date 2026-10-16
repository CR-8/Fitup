import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme) => ({
    container: {
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(2),
    },
    button: {
        height: theme.space(12),
        width: theme.space(12),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.elevated,
    },
    value: {
        fontSize: 32,
        lineHeight: 36,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
}));

type StepperProps = {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    label: string;
};

/** Large − / + around the number: easier than a text field for a small count. */
export const Stepper: FC<StepperProps> = ({ value, min, max, onChange, label }) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common']);

    return (
        <HStack style={styles.container} accessibilityRole="adjustable" accessibilityLabel={label}>
            <Pressable
                style={styles.button}
                disabled={value <= min}
                onPress={() => onChange(Math.max(min, value - 1))}
                accessibilityRole="button"
                accessibilityLabel={t('decrease', { ns: 'common', defaultValue: 'Decrease' })}
            >
                <Icon name="minus" size={theme.space(5)} />
            </Pressable>
            <Text style={styles.value} accessibilityLiveRegion="polite">
                {value}
            </Text>
            <Pressable
                style={styles.button}
                disabled={value >= max}
                onPress={() => onChange(Math.min(max, value + 1))}
                accessibilityRole="button"
                accessibilityLabel={t('increase', { ns: 'common', defaultValue: 'Increase' })}
            >
                <Icon name="plus" size={theme.space(5)} />
            </Pressable>
        </HStack>
    );
};
