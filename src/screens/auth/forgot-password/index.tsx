import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Button } from '@/components/buttons/base';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { sendPasswordReset } from '@/services/account';
import { errorKey, reportUnexpected } from '@/screens/auth/errors';
import { AuthHero } from '@/screens/auth/components/hero';

/**
 * Asks where to send a password-reset link.
 *
 * One field, because that is the whole question. The screen exists at all
 * because `sendPasswordReset` has been in `src/services/account.ts` since the
 * account work began with nothing calling it — the function was written, the
 * way in never was, so a forgotten password meant a new account.
 *
 * It reports success whatever happens. Supabase deliberately answers the same
 * for an address it has never seen, and saying otherwise here would turn this
 * into a way to ask whether a particular person uses the app.
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
    panel: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(4),
    },
    fieldContainer: {
        gap: theme.space(2),
    },
}));

// Keys, not sentences — see `BaseInput`, which looks the message up in the
// `common` namespace before rendering it.
const schema = z.object({
    email: z
        .string('errors.auth.email.required')
        .trim()
        .min(1, 'errors.auth.email.required')
        .email('errors.auth.email.invalid'),
});

type ForgotPasswordForm = z.infer<typeof schema>;

const ForgotPasswordScreen = () => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordForm>({ resolver: zodResolver(schema) });

    const onSubmit = handleSubmit(async (values) => {
        try {
            await sendPasswordReset(values.email);
        } catch (error) {
            // A rate limit is the one failure worth stopping for: sending them
            // to wait for an email that was never sent is worse than saying so.
            reportUnexpected(error, 'Password reset could not be requested');
            Alert.alert(t(errorKey(error), { ns: 'screens' }));

            return;
        }

        router.replace(
            `/auth/check-email?email=${encodeURIComponent(values.email)}&reason=recovery`,
        );
    });

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <AuthHero
                icon={KeyRound}
                eyebrow={t('forgotPassword.eyebrow', { ns: 'screens' })}
                title={t('forgotPassword.title', { ns: 'screens' })}
                subtitle={t('forgotPassword.subtitle', { ns: 'screens' })}
            />

            <VStack style={styles.panel}>
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

                <Button
                    size="sm"
                    title={t('forgotPassword.action', { ns: 'screens' })}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    onPress={onSubmit}
                    spinnerColor={
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50]
                    }
                />
            </VStack>
        </ScrollView>
    );
};

export default ForgotPasswordScreen;
