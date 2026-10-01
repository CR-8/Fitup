import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

import { greetingKeyForHour } from './salutation';

/**
 * Replaces a heading that said "Home".
 *
 * The name has been sitting on the user row since onboarding without appearing
 * anywhere, and a screen that opens by naming itself tells you nothing you did
 * not know from tapping its tab.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(0.5),
    },
    salutation: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    tagline: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

export const Greeting: FC = () => {
    const { t } = useTranslation(['screens']);
    const salutation = t(`home.greeting.${greetingKeyForHour(new Date().getHours())}`, {
        ns: 'screens',
    });

    // The name is the navigation bar's large title and settings is its button;
    // this is the line of context beneath them.
    return (
        <VStack style={styles.container}>
            <Text style={styles.salutation}>{salutation}</Text>
            <Text style={styles.tagline}>{t('home.greeting.tagline', { ns: 'screens' })}</Text>
        </VStack>
    );
};
