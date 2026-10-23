import { router, Stack } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/buttons/base';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';

/** A link to nowhere: a plain line on the app's own page, and the way back to Today. */
export default function NotFoundScreen() {
    useAnalyticsScreen('not_found');
    const { t } = useTranslation(['screens']);

    return (
        <>
            <Stack.Screen options={{ title: '' }} />
            <VStack style={styles.container}>
                <Text style={styles.title} accessibilityRole="header">
                    {t('notFound.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.body}>{t('notFound.body', { ns: 'screens' })}</Text>
                <Button
                    type="primary"
                    title={t('notFound.home', { ns: 'screens' })}
                    containerStyle={styles.button}
                    onPress={() => router.replace('/')}
                />
            </VStack>
        </>
    );
}

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(2),
        padding: theme.space(6),
        backgroundColor: theme.colors.background,
    },
    title: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
    },
    body: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    button: {
        marginTop: theme.space(4),
    },
}));
