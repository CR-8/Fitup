import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Button } from '@/components/buttons/base';
import { Label } from '@/components/forms/label';
import { useAccount } from '@/hooks/use-account';
import { reportError } from '@/services/error-reporting';

/**
 * The account's only entry point.
 *
 * Sign-in used to be reachable exactly once, from the first-launch gate, which
 * meant anyone who skipped it could never sign in again and anyone signed in
 * could never sign out. Both functions existed; neither had a way in.
 *
 * The screen leads with what is true whichever state you are in: training lives
 * on this device. Signing out is the moment people expect to lose their history,
 * so it says plainly that they will not.
 */

const RETURN_TO = '/settings/account';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    panel: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(4),
    },
    field: {
        gap: theme.space(1),
    },
    email: {
        color: theme.colors.typography,
    },
    muted: {
        color: theme.colors.neutral[400],
    },
}));

const AccountScreen = () => {
    const { t } = useTranslation(['screens']);
    const { session, isSignedIn, signOut } = useAccount();
    const [pending, setPending] = useState(false);

    const handleSignIn = useCallback(() => {
        // Carries the way back, so finishing here returns here rather than
        // dropping the user on Home with no confirmation anything happened.
        router.navigate(`/sign-in?returnTo=${encodeURIComponent(RETURN_TO)}`);
    }, []);

    const handleSignOut = useCallback(() => {
        Alert.alert(
            t('settings.account.signedIn.confirmTitle', { ns: 'screens' }),
            t('settings.account.signedIn.confirmBody', { ns: 'screens' }),
            [
                { text: t('settings.account.signedIn.cancel', { ns: 'screens' }), style: 'cancel' },
                {
                    text: t('settings.account.signedIn.action', { ns: 'screens' }),
                    style: 'destructive',
                    onPress: () => {
                        setPending(true);

                        signOut()
                            .then(() => {
                                // The root layout drops every app route the moment
                                // the session clears, which lands the user here on
                                // its own. This is belt-and-braces, and it keeps the
                                // intent readable at the call site.
                                router.replace('/sign-in');
                            })
                            .catch((error) => {
                                reportError(error, 'Failed to sign out');
                                // Only reachable if the sign-out threw, so the
                                // screen is still mounted and the button has to be
                                // usable again. On success this screen is gone.
                                setPending(false);
                            });
                    },
                },
            ],
        );
    }, [signOut, t]);

    const provider = session?.user.app_metadata.provider;
    const providerLabel =
        provider === 'google' || provider === 'apple' || provider === 'email'
            ? t(`settings.account.signedIn.provider.${provider}`, { ns: 'screens' })
            : null;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.panel}>
                {isSignedIn ? (
                    <>
                        <VStack style={styles.field}>
                            <Label>{t('settings.account.signedIn.label', { ns: 'screens' })}</Label>
                            <Text fontSize="lg" fontWeight="semibold" style={styles.email}>
                                {session?.user.email ??
                                    t('settings.account.signedIn.noEmail', { ns: 'screens' })}
                            </Text>
                            {providerLabel ? (
                                <Text fontSize="xs" style={styles.muted}>
                                    {providerLabel}
                                </Text>
                            ) : null}
                        </VStack>

                        <Text fontSize="xs" style={styles.muted}>
                            {t('settings.account.signedIn.note', { ns: 'screens' })}
                        </Text>

                        <Button
                            size="sm"
                            title={t('settings.account.signedIn.action', { ns: 'screens' })}
                            loading={pending}
                            disabled={pending}
                            onPress={handleSignOut}
                        />
                    </>
                ) : (
                    <>
                        <VStack style={styles.field}>
                            <Text fontSize="lg" fontWeight="semibold" style={styles.email}>
                                {t('settings.account.signedOut.title', { ns: 'screens' })}
                            </Text>
                            <Text fontSize="sm" style={styles.muted}>
                                {t('settings.account.signedOut.description', { ns: 'screens' })}
                            </Text>
                        </VStack>

                        <Button
                            size="sm"
                            title={t('settings.account.signedOut.action', { ns: 'screens' })}
                            onPress={handleSignIn}
                        />
                    </>
                )}
            </VStack>
        </ScrollView>
    );
};

export default AccountScreen;
