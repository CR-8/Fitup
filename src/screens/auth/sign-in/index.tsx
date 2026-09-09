import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { Separator } from '@/components/layout/separator';
import { MIN_PASSWORD_LENGTH } from '@/constants/auth';
import {
    AuthError,
    claimOAuthNavigation,
    isGoogleAvailable,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    setOAuthReturnTo,
} from '@/services/account';
import { resolveAuthDestination } from '@/services/auth-navigation';
import { errorKey, reportUnexpected } from '@/screens/auth/errors';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    intro: {
        gap: theme.space(2),
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
    providerButton: {
        backgroundColor: theme.colors.foreground,
    },
    providerButtonText: {
        color: theme.colors.typography,
    },
    fieldContainer: {
        gap: theme.space(2),
    },
    dividerRow: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    link: {
        // 44dp, the Apple HIG / WCAG 2.5.5 minimum. Padding alone gave these
        // roughly 32dp, which is a hard target to hit and easy to miss.
        minHeight: theme.space(11),
        justifyContent: 'center',
        paddingVertical: theme.space(2),
    },
}));

// Messages are keys in the `common` namespace: `BaseInput` renders a field
// error as `t(error.message, { ns: 'common' })`. Without them zod's own English
// reached the screen — an untouched email field read "Invalid input: expected
// string, received undefined".
const schema = z.object({
    email: z
        .string('errors.auth.email.required')
        .trim()
        .min(1, 'errors.auth.email.required')
        .email('errors.auth.email.invalid'),
    password: z
        .string('errors.auth.password.required')
        .min(MIN_PASSWORD_LENGTH, 'errors.auth.password.tooShort'),
});

type SignInForm = z.infer<typeof schema>;

const SignInScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();
    // Set when the screen is opened deliberately (from Settings) rather than by
    // the first-launch gate.
    const { returnTo, reason } = useLocalSearchParams<{ returnTo?: string; reason?: string }>();
    const [pending, setPending] = useState<'google' | 'email' | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<SignInForm>({ resolver: zodResolver(schema) });

    /**
     * Said once, on arrival. The auth callback sends people here when a link has
     * expired, and it cannot show the message itself — it is a bare background
     * that exists only to redirect, and an alert raised there would be dismissed
     * onto a screen that had already gone.
     */
    useEffect(() => {
        if (reason === 'linkExpired') {
            Alert.alert(t('signIn.errors.linkExpired', { ns: 'screens' }));
        }
    }, [reason, t]);

    /**
     * Published so the callback screen can honour the same destination: the OAuth
     * redirect may be landed by either screen, and only this one saw the param.
     */
    useEffect(() => {
        setOAuthReturnTo(returnTo ?? null);
    }, [returnTo]);

    const onAuthenticated = useCallback(async () => {
        router.replace(await resolveAuthDestination());
    }, []);

    const runProvider = useCallback(
        async (provider: 'google', signIn: () => Promise<unknown>) => {
            setPending(provider);

            try {
                await signIn();

                // The deep-link callback screen may have got here first and already
                // moved on; navigating again would replace its destination with ours.
                if (claimOAuthNavigation()) await onAuthenticated();
            } catch (error) {
                // A user backing out of the provider sheet is not a failure.
                if (error instanceof AuthError && error.code === 'CANCELLED') return;

                reportUnexpected(error, `Sign-in with ${provider} failed`);
                Alert.alert(t(errorKey(error), { ns: 'screens' }));
            } finally {
                setPending(null);
            }
        },
        [onAuthenticated, t],
    );

    const goToCheckEmail = useCallback((email: string) => {
        router.push(`/auth/check-email?email=${encodeURIComponent(email)}&reason=signup`);
    }, []);

    const onSubmitEmail = handleSubmit(async (values) => {
        setPending('email');

        try {
            if (isRegistering) {
                const { needsEmailConfirmation } = await signUpWithEmail(
                    values.email,
                    values.password,
                );

                // A screen, not an alert. The alert had a single button, and
                // dismissing it returned the person to a form whose account had
                // already been created — nothing to submit, nothing to press,
                // and no way to ask for the email again.
                if (needsEmailConfirmation) return goToCheckEmail(values.email);
            } else {
                await signInWithEmail(values.email, values.password);
            }

            await onAuthenticated();
        } catch (error) {
            // Not a failed sign-in so much as an unfinished sign-up: the
            // confirmation is sitting in an inbox. Send them where they can
            // act on it rather than repeating the password back at them.
            if (error instanceof AuthError && error.code === 'EMAIL_NOT_CONFIRMED') {
                return goToCheckEmail(values.email);
            }

            reportUnexpected(error, 'Email sign-in failed');
            Alert.alert(t(errorKey(error), { ns: 'screens' }));
        } finally {
            setPending(null);
        }
    });

    const busy = pending !== null;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.intro}>
                <Title type="h1">
                    {t(returnTo ? 'signIn.titleReturning' : 'signIn.title', { ns: 'screens' })}
                </Title>
                <Text fontSize="sm" style={styles.muted}>
                    {t('signIn.subtitle', { ns: 'screens' })}
                </Text>
            </VStack>

            <VStack style={styles.panel}>
                {isGoogleAvailable() ? (
                    <Button
                        size="sm"
                        title={t('signIn.google', { ns: 'screens' })}
                        loading={pending === 'google'}
                        disabled={busy}
                        onPress={() => runProvider('google', signInWithGoogle)}
                        containerStyle={styles.providerButton}
                        textStyle={styles.providerButtonText}
                        spinnerColor={theme.colors.typography}
                    />
                ) : null}

                <Separator />

                <VStack style={styles.fieldContainer}>
                    <Label>{t('signIn.email', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="email"
                        valueType="text"
                        error={errors.email}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                    />
                </VStack>

                <VStack style={styles.fieldContainer}>
                    <Label>{t('signIn.password', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="password"
                        valueType="text"
                        error={errors.password}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        // Telling the OS which of the two this is decides whether it
                        // offers to fill an existing password or save a new one.
                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                        textContentType={isRegistering ? 'newPassword' : 'password'}
                    />
                </VStack>

                <Button
                    size="sm"
                    title={
                        isRegistering
                            ? t('signIn.createAccount', { ns: 'screens' })
                            : t('signIn.continue', { ns: 'screens' })
                    }
                    loading={pending === 'email'}
                    disabled={busy}
                    onPress={onSubmitEmail}
                    spinnerColor={
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50]
                    }
                />

                <Pressable style={styles.link} onPress={() => setIsRegistering((value) => !value)}>
                    <Text fontSize="xs" style={[styles.muted, { textAlign: 'center' }]}>
                        {isRegistering
                            ? t('signIn.haveAccount', { ns: 'screens' })
                            : t('signIn.needAccount', { ns: 'screens' })}
                    </Text>
                </Pressable>

                {/* Offered only when signing in. Someone creating an account has
                    no password to have forgotten, and the link would just be one
                    more thing to read. */}
                {isRegistering ? null : (
                    <Pressable
                        style={styles.link}
                        disabled={busy}
                        onPress={() => router.push('/auth/forgot-password')}
                    >
                        <Text fontSize="xs" style={[styles.muted, { textAlign: 'center' }]}>
                            {t('signIn.forgotPassword', { ns: 'screens' })}
                        </Text>
                    </Pressable>
                )}
            </VStack>
        </ScrollView>
    );
};

export default SignInScreen;
