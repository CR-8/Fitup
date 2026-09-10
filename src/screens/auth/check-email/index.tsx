import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { resendConfirmation, sendPasswordReset } from '@/services/account';
import { errorKey, reportUnexpected } from '@/screens/auth/errors';
import { AuthHero } from '@/screens/auth/components/hero';

/**
 * The wait for an email, made into somewhere to be.
 *
 * Both flows stop here — a new sign-up and a password reset — because both end
 * with the same instruction and the same two things that can go wrong: the
 * message goes to spam, or the address was typed wrong. So the address is shown
 * back, there is a way to send it again, and there is a way back to change it.
 *
 * This replaced a one-button `Alert`. The alert dismissed onto the form the
 * person had just submitted, which by then had an account behind it and nothing
 * left to do.
 */

/**
 * Long enough to clear Supabase's own limit, which answers a hurried second
 * request with an error rather than an email. Better to hold the button than to
 * spend the attempt and report a failure that reads like a bug.
 */
const RESEND_COOLDOWN_SECONDS = 60;

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    panel: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(4),
    },
    address: {
        color: theme.colors.typography,
    },
    link: {
        // 44dp, the Apple HIG / WCAG 2.5.5 minimum.
        minHeight: theme.space(11),
        justifyContent: 'center',
        paddingVertical: theme.space(2),
    },
}));

const CheckEmailScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();
    const { email = '', reason } = useLocalSearchParams<{ email?: string; reason?: string }>();

    const isRecovery = reason === 'recovery';
    const [pending, setPending] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

    // Starts spent, because arriving here means one has just been sent.
    useEffect(() => {
        if (cooldown <= 0) return;

        const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);

        return () => clearTimeout(timer);
    }, [cooldown]);

    const onResend = useCallback(async () => {
        setPending(true);

        try {
            // Same address, different message: a reset link for someone who has
            // an account, a confirmation for someone who has just made one.
            await (isRecovery ? sendPasswordReset(email) : resendConfirmation(email));

            setCooldown(RESEND_COOLDOWN_SECONDS);
            Alert.alert(t('checkEmail.resent', { ns: 'screens' }));
        } catch (error) {
            reportUnexpected(error, 'Could not resend the confirmation email');
            Alert.alert(t(errorKey(error), { ns: 'screens' }));
        } finally {
            setPending(false);
        }
    }, [email, isRecovery, t]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <AuthHero
                icon={Mail}
                eyebrow={t('checkEmail.eyebrow', { ns: 'screens' })}
                title={t('checkEmail.title', { ns: 'screens' })}
                subtitle={t(isRecovery ? 'checkEmail.subtitleReset' : 'checkEmail.subtitleSignUp', {
                    ns: 'screens',
                })}
            />

            <VStack style={styles.panel}>
                <Text fontSize="lg" fontWeight="semibold" style={styles.address}>
                    {email}
                </Text>

                <Text fontSize="xs" style={styles.muted}>
                    {t('checkEmail.spamHint', { ns: 'screens' })}
                </Text>

                <Button
                    size="sm"
                    title={
                        cooldown > 0
                            ? t('checkEmail.resendIn', { ns: 'screens', seconds: cooldown })
                            : t('checkEmail.resend', { ns: 'screens' })
                    }
                    loading={pending}
                    disabled={pending || cooldown > 0}
                    onPress={onResend}
                    spinnerColor={
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50]
                    }
                />

                {/* `replace`, not `back`: this screen is reached by `push` from
                    the sign-in form and by `replace` from forgot-password, so
                    there is no one history entry behind it to return to. */}
                <Pressable style={styles.link} onPress={() => router.replace('/sign-in')}>
                    <Text fontSize="xs" style={[styles.muted, { textAlign: 'center' }]}>
                        {t('checkEmail.back', { ns: 'screens' })}
                    </Text>
                </Pressable>
            </VStack>
        </ScrollView>
    );
};

export default CheckEmailScreen;
