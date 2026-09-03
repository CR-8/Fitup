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
    isAppleAvailable,
    isGoogleAvailable,
    signInWithApple,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    setOAuthReturnTo,
} from '@/services/account';
import { resolveAuthDestination } from '@/services/auth-navigation';
import { reportError } from '@/services/error-reporting';

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

const schema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(MIN_PASSWORD_LENGTH),
});

type SignInForm = z.infer<typeof schema>;

const errorKey = (error: unknown): string => {
    if (error instanceof AuthError) {
        switch (error.code) {
            case 'INVALID_CREDENTIALS':
                return 'signIn.errors.invalidCredentials';
            case 'EMAIL_IN_USE':
                return 'signIn.errors.emailInUse';
            case 'WEAK_PASSWORD':
                return 'signIn.errors.weakPassword';
            case 'EMAIL_NOT_CONFIRMED':
                return 'signIn.errors.emailNotConfirmed';
            case 'NETWORK':
                return 'signIn.errors.network';
            case 'DISABLED':
            case 'UNSUPPORTED':
                return 'signIn.errors.unavailable';
            default:
                return 'signIn.errors.unknown';
        }
    }

    return 'signIn.errors.unknown';
};

const SignInScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();
    // Set when the screen is opened deliberately (from Settings) rather than by
    // the first-launch gate.
    const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [pending, setPending] = useState<'google' | 'apple' | 'email' | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<SignInForm>({ resolver: zodResolver(schema) });

    useEffect(() => {
        isAppleAvailable()
            .then(setAppleAvailable)
            .catch(() => setAppleAvailable(false));
    }, []);

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
        async (provider: 'google' | 'apple', signIn: () => Promise<unknown>) => {
            setPending(provider);

            try {
                await signIn();

                // The deep-link callback screen may have got here first and already
                // moved on; navigating again would replace its destination with ours.
                if (claimOAuthNavigation()) await onAuthenticated();
            } catch (error) {
                // A user backing out of the provider sheet is not a failure.
                if (error instanceof AuthError && error.code === 'CANCELLED') return;

                reportError(error, `Sign-in with ${provider} failed`);
                Alert.alert(t(errorKey(error), { ns: 'screens' }));
            } finally {
                setPending(null);
            }
        },
        [onAuthenticated, t],
    );

    const onSubmitEmail = handleSubmit(async (values) => {
        setPending('email');

        try {
            if (isRegistering) {
                const { needsEmailConfirmation } = await signUpWithEmail(
                    values.email,
                    values.password,
                );

                if (needsEmailConfirmation) {
                    Alert.alert(t('signIn.confirmEmail', { ns: 'screens' }));
                    return;
                }
            } else {
                await signInWithEmail(values.email, values.password);
            }

            await onAuthenticated();
        } catch (error) {
            reportError(error, 'Email sign-in failed');
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

                {appleAvailable ? (
                    <Button
                        size="sm"
                        title={t('signIn.apple', { ns: 'screens' })}
                        loading={pending === 'apple'}
                        disabled={busy}
                        onPress={() => runProvider('apple', signInWithApple)}
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
            </VStack>
        </ScrollView>
    );
};

export default SignInScreen;
