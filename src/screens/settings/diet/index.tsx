import { useState } from 'react';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/primitives/text';
import { Button } from '@/components/buttons/base';
import { useAiProfile } from '@/hooks/use-ai';
import { reportError } from '@/services/error-reporting';
import { DietFields, type DietAnswers } from '@/screens/coach/new/components/diet-fields';

/**
 * Diet and allergies, outside a meal-plan build. Only what is changed here is
 * saved: an answer never given stays unknown rather than becoming "none".
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(4),
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

const DietScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { profile, save, isSaving } = useAiProfile();
    const [draft, setDraft] = useState<DietAnswers>({});

    const diet =
        draft.dietaryPattern !== undefined
            ? draft.dietaryPattern
            : (profile?.dietaryPattern ?? null);
    const allergens = draft.allergens ?? profile?.allergens ?? [];

    const handleSave = async () => {
        try {
            await save(draft);
            router.back();
        } catch (error) {
            reportError(error, 'Failed to save diet preferences');
            Alert.alert(t('settings.profile.saveFailed', { ns: 'screens' }));
        }
    };

    return (
        <KeyboardAwareScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            bottomOffset={theme.space(6)}
        >
            <Text style={styles.hint}>{t('settings.diet.subtitle', { ns: 'screens' })}</Text>
            <DietFields
                diet={diet}
                allergens={allergens}
                onChange={(updates) => setDraft((current) => ({ ...current, ...updates }))}
            />
            <Button
                type="primary"
                title={t('settings.profile.save', { ns: 'screens' })}
                loading={isSaving}
                disabled={isSaving}
                onPress={() => void handleSave()}
            />
        </KeyboardAwareScrollView>
    );
};

export default DietScreen;
