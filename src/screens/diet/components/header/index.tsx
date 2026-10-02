import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Text } from '@/components/primitives/text';
import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';

const styles = StyleSheet.create((theme) => ({
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

/** The native header, with Done to dismiss the screen, and the subtitle below it. */
export const DietHeader: FC = () => {
    const { t } = useTranslation(['screens', 'common']);

    return (
        <>
            <Stack.Screen
                options={{
                    title: t('diet.title', { ns: 'screens' }),
                    headerRight: () => (
                        <HeaderTextButton
                            title={t('done', { ns: 'common' })}
                            onPress={() => router.back()}
                            prominent
                        />
                    ),
                }}
            />
            <Text style={styles.subtitle}>{t('diet.subtitle', { ns: 'screens' })}</Text>
        </>
    );
};
