import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { BackButton } from '@/components/buttons/back';

const styles = StyleSheet.create((theme) => ({
    // The screen is presented as a card with the native header switched off, so
    // the only way back was the swipe gesture. The shared back button is the
    // same control every other pushed screen uses.
    topRow: {
        alignItems: 'center',
    },
    header: {
        gap: theme.space(1),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

/** An in-page header: the back button, then the title and subtitle. */
export const DietHeader: FC = () => {
    const { t } = useTranslation(['screens']);

    return (
        <>
            <HStack style={styles.topRow}>
                <BackButton onPressHandler={() => router.back()} />
            </HStack>

            <VStack style={styles.header}>
                <Title type="h1">{t('diet.title', { ns: 'screens' })}</Title>
                <Text style={styles.subtitle}>{t('diet.subtitle', { ns: 'screens' })}</Text>
            </VStack>
        </>
    );
};
