import { FC, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { NumericStepperField } from '@/components/primitives/numeric-stepper-field';
import { Button } from '@/components/buttons/base';
import { HeaderTextButton } from '@/components/buttons/header';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useAiProfile } from '@/hooks/use-ai';
import { useTodayKey } from '@/hooks/use-water';
import { reportError } from '@/services/error-reporting';
import { useCaloriesStore } from '@/stores/calories';
import { useCalorieDays } from '@/screens/home/summary';

/**
 * The calorie goal, stepped up or down: for the ring's day only (`mode=today`,
 * kept on the device) or every day (`mode=daily`, the profile's target).
 */

/** A starting point when neither a goal nor a meal plan says anything. */
const FALLBACK_GOAL = 2000;

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    body: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    stepper: {
        paddingVertical: theme.space(10),
        gap: theme.space(3),
    },
    unit: {
        ...theme.typography.eyebrow,
        textAlign: 'center',
        textTransform: 'uppercase',
        color: theme.colors.typography,
    },
}));

const CalorieGoalScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { mode } = useLocalSearchParams<{ mode?: string }>();
    const daily = mode === 'daily';
    const today = useTodayKey();
    const day = useCaloriesStore((state) => state.day) || today;
    const setOverride = useCaloriesStore((state) => state.setOverride);
    const { save } = useAiProfile();
    const { goalFor } = useCalorieDays(day, day);

    // Held as an edit over the current goal, which can still be loading on open.
    const [edited, setEdited] = useState<number | null>(null);
    const value = edited ?? (goalFor(day) || FALLBACK_GOAL);

    const key = daily ? 'daily' : 'today';

    const confirm = async () => {
        if (daily) {
            try {
                await save({ dailyCalorieTarget: value });
            } catch (error) {
                reportError(error, 'Failed to save the daily calorie goal:');
                return;
            }
        } else {
            setOverride(day, value);
        }
        router.back();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t(`calories.goal.${key}.title`, { ns: 'screens' })}
                done={false}
                right={
                    <HeaderTextButton
                        title={t('cancel', { ns: 'common' })}
                        onPress={() => router.back()}
                    />
                }
            />
            <Text style={styles.body}>{t(`calories.goal.${key}.body`, { ns: 'screens' })}</Text>

            <VStack style={styles.stepper}>
                <NumericStepperField
                    value={value}
                    unit=""
                    onChange={setEdited}
                    modalTitle={t(`calories.goal.${key}.title`, { ns: 'screens' })}
                    step={50}
                    min={500}
                    max={10000}
                />
                <Text style={styles.unit}>{t('calories.goal.unit', { ns: 'screens' })}</Text>
            </VStack>

            <Button
                type="primary"
                title={t(`calories.goal.${key}.save`, { ns: 'screens' })}
                onPress={confirm}
            />
        </ScrollView>
    );
};

export default CalorieGoalScreen;
