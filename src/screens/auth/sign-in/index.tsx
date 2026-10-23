import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image } from 'expo-image';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
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
import { errorKey, reportUnexpected } from '@/screens/auth/errors';

// The app icon's own artwork, so the first screen and the home screen match.
const LOGO = require('../../../../assets/images/logo.png');

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(6),
    },
    // No bar above sign-in on iOS, which insets the scroll view under the status
    // bar itself. Android keeps the pre-native header clearance.
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    logoRow: {
        alignItems: 'center',
        paddingTop: theme.space(2),
    },
    logo: {
        height: theme.space(16),
        width: theme.space(16),
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
    },
    // As the reference's setup screens: a centred title over one paragraph,
    // then the fields grouped on one card.
    heading: {
        alignItems: 'center',
        gap: theme.space(1),
    },
    title: {
        textAlign: 'center',
    },
    subtitle: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    fieldsCard: {
        gap: theme.space(3),
        padding: theme.space(4),
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
    },
    fieldDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    muted: {
        color: theme.colors.mutedTypography,
    },
    fieldContainer: {
        gap: theme.space(2),
    },
    dividerRow: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    providers: {
        gap: theme.space(3),
    },
    forgot: {
        alignSelf: 'flex-end',
        minHeight: theme.space(11),
        justifyContent: 'center',
    },
    forgotText: {
        ...theme.fontSize.sm,
        color: theme.colors.brand[400],
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    link: {
        // 44dp, the Apple HIG / WCAG 2.5.5 minimum. Padding alone gave these
        // roughly 32dp, which is a hard target to hit and easy to miss.
        minHeight: theme.space(11),
        justifyContent: 'center',
        paddingVertical: theme.space(2),
    },
    linkText: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    terms: {
        ...theme.fontSize.xs,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
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

type Provider = 'google' | 'apple';

const SignInScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    // `returnTo` is set when the screen is opened deliberately (from Settings)
    // rather than by the first-launch gate; `mode=register` when Welcome's
    // "Get started" sent the person here.
    const { returnTo, reason, mode } = useLocalSearchParams<{
        returnTo?: string;
        reason?: string;
        mode?: string;
    }>();
    const [pending, setPending] = useState<Provider | 'email' | null>(null);
    const [isRegistering, setIsRegistering] = useState(mode === 'register');

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
        async (provider: Provider, signIn: () => Promise<unknown>) => {
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
    const hasProviders = isAppleAvailable() || isGoogleAvailable();

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <Box style={styles.logoRow}>
                <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
            </Box>

            <VStack style={styles.heading}>
                <Title type="h1" style={styles.title} accessibilityRole="header">
                    {isRegistering
                        ? t('signIn.registerTitle', { ns: 'screens' })
                        : t(returnTo ? 'signIn.titleReturning' : 'signIn.title', { ns: 'screens' })}
                </Title>
                <Text style={styles.subtitle}>
                    {isRegistering
                        ? t('signIn.registerSubtitle', { ns: 'screens' })
                        : t('signIn.subtitle', { ns: 'screens' })}
                </Text>
            </VStack>

            <VStack style={styles.fieldsCard}>
                <VStack style={styles.fieldContainer}>
                    <Label field>{t('signIn.email', { ns: 'screens' })}</Label>
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

                <Box style={styles.fieldDivider} />

                <VStack style={styles.fieldContainer}>
                    <Label field>{t('signIn.password', { ns: 'screens' })}</Label>
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
            </VStack>

            {/* Offered only when signing in. Someone creating an account has
                no password to have forgotten. */}
            {isRegistering ? null : (
                <Pressable
                    style={styles.forgot}
                    disabled={busy}
                    onPress={() => router.push('/auth/forgot-password')}
                    accessibilityRole="button"
                >
                    <Text style={styles.forgotText}>
                        {t('signIn.forgotPassword', { ns: 'screens' })}
                    </Text>
                </Pressable>
            )}

            <Button
                type="primary"
                title={
                    isRegistering
                        ? t('signIn.createAccount', { ns: 'screens' })
                        : t('signIn.continue', { ns: 'screens' })
                }
                loading={pending === 'email'}
                disabled={busy}
                onPress={onSubmitEmail}
                spinnerColor={theme.solid.primaryTypography}
            />

            {hasProviders ? (
                <>
                    <HStack style={styles.dividerRow}>
                        <Box style={styles.dividerLine} />
                        <Text fontSize="xs" style={styles.muted}>
                            {t('signIn.orContinueWith', { ns: 'screens' })}
                        </Text>
                        <Box style={styles.dividerLine} />
                    </HStack>

                    {/* Labelled and full width. Apple first where it exists: its
                        guidelines ask for it to be at least as prominent as any
                        other third-party option. */}
                    <VStack style={styles.providers}>
                        {isAppleAvailable() ? (
                            <Button
                                type="outline"
                                icon="apple"
                                title={t('signIn.apple', { ns: 'screens' })}
                                loading={pending === 'apple'}
                                disabled={busy}
                                onPress={() => runProvider('apple', signInWithApple)}
                                spinnerColor={theme.solid.typography}
                            />
                        ) : null}
                        {isGoogleAvailable() ? (
                            <Button
                                type="outline"
                                title={t('signIn.google', { ns: 'screens' })}
                                loading={pending === 'google'}
                                disabled={busy}
                                onPress={() => runProvider('google', signInWithGoogle)}
                                spinnerColor={theme.solid.typography}
                            />
                        ) : null}
                    </VStack>
                </>
            ) : null}

            <Pressable
                style={styles.link}
                onPress={() => setIsRegistering((value) => !value)}
                accessibilityRole="button"
            >
                <Text style={styles.linkText}>
                    {isRegistering
                        ? t('signIn.haveAccount', { ns: 'screens' })
                        : t('signIn.needAccount', { ns: 'screens' })}
                </Text>
            </Pressable>

            <Text style={styles.terms}>{t('signIn.terms', { ns: 'screens' })}</Text>
        </ScrollView>
    );
};

export default SignInScreen;
