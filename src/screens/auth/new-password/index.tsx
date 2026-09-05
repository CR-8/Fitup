import { useCallback, useState } from 'react';
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
import { MIN_PASSWORD_LENGTH } from '@/constants/auth';
import { useAccount } from '@/hooks/use-account';
import { updatePassword } from '@/services/account';
import { resolveAuthDestination } from '@/services/auth-navigation';
import { endPasswordRecovery } from '@/services/password-recovery';
import { errorKey } from '@/screens/auth/errors';
import { reportError } from '@/services/error-reporting';

/**
 * Sets a password on the session that is already open.
 *
 * Reached two ways, and the difference is what `returnTo` means:
 *
 * - From a reset link, with no `returnTo`. The session was opened by the link
 *   itself, `beginPasswordRecovery` is set, and this screen is the only thing
 *   standing between the recipient and an account whose password they told us
 *   they had forgotten. It cannot be dismissed — there is no back, and the only
 *   way past it other than setting a password is to sign out.
 * - From Settings, with `returnTo`. An ordinary change of password by someone
 *   already signed in, and going back is perfectly reasonable.
 */

const styles = StyleSheet.create((theme) => ({
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
    fieldContainer: {
        gap: theme.space(2),
    },
    link: {
        // 44dp, the Apple HIG / WCAG 2.5.5 minimum.
        minHeight: theme.space(11),
        justifyContent: 'center',
        paddingVertical: theme.space(2),
    },
}));

const schema = z
    .object({
        password: z.string().min(MIN_PASSWORD_LENGTH),
        confirmPassword: z.string(),
    })
    // Two fields because there is no way back from a typo here: the session that
    // let them set it is single-use, so a mistyped password means asking for a
    // second reset email.
    // The message is a key in the `common` namespace: `BaseInput` renders a
    // field error as `t(error.message, { ns: 'common' })`.
    .refine((values) => values.password === values.confirmPassword, {
        path: ['confirmPassword'],
        message: 'passwordMismatch',
    });

type NewPasswordForm = z.infer<typeof schema>;

const NewPasswordScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();
    const { signOut } = useAccount();
    const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

    const isRecovery = !returnTo;
    const [pending, setPending] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<NewPasswordForm>({ resolver: zodResolver(schema) });

    const onSubmit = handleSubmit(async (values) => {
        setPending(true);

        try {
            await updatePassword(values.password);

            // Only once it has actually been set. Clearing earlier would drop
            // the guard while the old password was still the live one.
            endPasswordRecovery();

            if (returnTo) {
                router.back();
                return;
            }

            // Same rules as any other completed sign-in: onboarding if they have
            // never answered it, training if they have.
            router.replace(await resolveAuthDestination());
        } catch (error) {
            reportError(error, 'Could not set a new password');
            Alert.alert(t(errorKey(error), { ns: 'screens' }));
            setPending(false);
        }
    });

    /**
     * The way out for someone who opened a link meant for somebody else, or who
     * changed their mind. Without it the screen is a trap: the session is real,
     * so the app would open here again on the next launch.
     */
    const onAbandon = useCallback(() => {
        endPasswordRecovery();

        signOut()
            .then(() => router.replace('/sign-in'))
            .catch((error) => reportError(error, 'Failed to sign out of a recovery session'));
    }, [signOut]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.intro}>
                <Title type="h1">
                    {t(isRecovery ? 'newPassword.title' : 'newPassword.titleChange', {
                        ns: 'screens',
                    })}
                </Title>
                <Text fontSize="sm" style={styles.muted}>
                    {t('newPassword.subtitle', { ns: 'screens', min: MIN_PASSWORD_LENGTH })}
                </Text>
            </VStack>

            <VStack style={styles.panel}>
                <VStack style={styles.fieldContainer}>
                    <Label>{t('newPassword.password', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="password"
                        valueType="text"
                        error={errors.password}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        textContentType="newPassword"
                    />
                </VStack>

                <VStack style={styles.fieldContainer}>
                    <Label>{t('newPassword.confirm', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="confirmPassword"
                        valueType="text"
                        error={errors.confirmPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        textContentType="newPassword"
                    />
                </VStack>

                <Button
                    size="sm"
                    title={t('newPassword.action', { ns: 'screens' })}
                    loading={pending}
                    disabled={pending}
                    onPress={onSubmit}
                    spinnerColor={
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50]
                    }
                />

                {isRecovery ? (
                    <Pressable style={styles.link} disabled={pending} onPress={onAbandon}>
                        <Text fontSize="xs" style={[styles.muted, { textAlign: 'center' }]}>
                            {t('newPassword.abandon', { ns: 'screens' })}
                        </Text>
                    </Pressable>
                ) : null}
            </VStack>
        </ScrollView>
    );
};

export default NewPasswordScreen;
