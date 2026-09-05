import { FC, useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Button } from '@/components/buttons/base';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { Buttons } from '@/components/forms/fields/buttons';
import { useUser } from '@/hooks/use-user';
import { useAccount } from '@/hooks/use-account';
import { readProfileDetails, saveProfileDetails, type ProfileDetails } from '@/crud/onboarding';
import { GUIDELINE_SESSIONS_PER_WEEK, MEDIAN_AGE_YEARS, worldAverages } from '@/constants/averages';
import { queryClient } from '@/queries';
import { reportError } from '@/services/error-reporting';

/**
 * The About You answers, after About You.
 *
 * They were previously write-once: the onboarding flow collected them and
 * nothing in the app could change them again, so a name typed wrong on day one
 * stayed wrong. Everything here is the same question asked in the same words —
 * the labels are the onboarding strings, deliberately, because they are the
 * same fields and two copies of a question drift.
 *
 * The email is shown and not editable. Changing the address means reverifying
 * it with the identity provider, which is a flow of its own.
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
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    panel: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(5),
    },
    field: {
        gap: theme.space(2),
    },
    email: {
        color: theme.colors.typography,
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    hint: {
        color: theme.colors.neutral[400],
    },
}));

const schema = z.object({
    displayName: z.string().trim().max(80).optional().nullable(),
    age: z.number().int().min(13).max(100).optional().nullable(),
    biologicalSex: z.enum(['female', 'male', 'other']).optional().nullable(),
    bodyWeightKg: z.number().min(20).max(400).optional().nullable(),
    heightCm: z.number().min(80).max(260).optional().nullable(),
    targetWeightKg: z.number().min(20).max(400).optional().nullable(),
    goal: z.enum(['lose', 'maintain', 'gain', 'recomp']).optional().nullable(),
    somatotype: z.enum(['ectomorph', 'mesomorph', 'endomorph']).optional().nullable(),
    activityLevel: z
        .enum(['sedentary', 'light', 'moderate', 'active', 'very_active'])
        .optional()
        .nullable(),
    sessionsPerWeek: z.number().int().min(0).max(14).optional().nullable(),
});

type ProfileForm = z.infer<typeof schema>;

/** Age is friendlier to answer than a date, so it is converted on both sides. */
const birthdayToAge = (birthday: Date | null): number | null => {
    if (!birthday) return null;

    const years = (Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    return years > 0 ? Math.round(years) : null;
};

const ageToBirthday = (age: number | null | undefined): Date | null => {
    if (typeof age !== 'number' || !Number.isFinite(age)) return null;

    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - Math.round(age));

    return birthday;
};

interface ProfileFormProps {
    userId: string;
    details: ProfileDetails;
}

/**
 * Split from the screen so the fields mount with their values already in hand.
 *
 * `BaseInput` seeds itself once and hands `defaultValue` to a React Native
 * `TextInput`, which reads it on mount and never again — so a form filled in by
 * `reset()` after the query returned changed the form state and not the screen,
 * and every text and number field on this page came up blank. The choice fields
 * are controlled and were the only ones that showed.
 */
const ProfileFormFields: FC<ProfileFormProps> = ({ userId, details }) => {
    const { t } = useTranslation(['screens', 'common']);
    const { session } = useAccount();

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ProfileForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            displayName: details.displayName,
            age: birthdayToAge(details.birthday),
            biologicalSex: details.biologicalSex,
            bodyWeightKg: details.bodyWeightKg,
            heightCm: details.heightCm,
            targetWeightKg: details.targetWeightKg,
            goal: details.goal,
            somatotype: details.somatotype,
            activityLevel: details.activityLevel,
            sessionsPerWeek: details.sessionsPerWeek,
        },
    });

    // Hints for whatever is still blank, following the answer to sex. Never
    // saved: an untouched field stays null.
    const biologicalSex = useWatch({ control, name: 'biologicalSex' });
    const averages = worldAverages(biologicalSex);

    const choices = useCallback(
        (group: string, values: readonly string[]) =>
            values.map((value) => ({
                value,
                title: t(`onboarding.${group}.${value}`, { ns: 'screens' }),
            })),
        [t],
    );

    const sexChoices = useMemo(() => choices('sex', ['female', 'male', 'other']), [choices]);
    const goalChoices = useMemo(
        () => choices('goal', ['lose', 'maintain', 'gain', 'recomp']),
        [choices],
    );
    const somatotypeChoices = useMemo(
        () => choices('somatotype', ['ectomorph', 'mesomorph', 'endomorph']),
        [choices],
    );
    const activityChoices = useMemo(
        () => choices('activity', ['sedentary', 'light', 'moderate', 'active', 'very_active']),
        [choices],
    );

    const onSubmit = handleSubmit(async (values) => {
        try {
            await saveProfileDetails(userId, {
                displayName: values.displayName ?? null,
                birthday: ageToBirthday(values.age),
                biologicalSex: values.biologicalSex ?? null,
                bodyWeightKg: values.bodyWeightKg ?? null,
                heightCm: values.heightCm ?? null,
                targetWeightKg: values.targetWeightKg ?? null,
                goal: values.goal ?? null,
                somatotype: values.somatotype ?? null,
                activityLevel: values.activityLevel ?? null,
                sessionsPerWeek: values.sessionsPerWeek ?? null,
            });

            // The name shows on Home and the weight drives the charts, so both
            // have readers outside this screen.
            await queryClient.invalidateQueries();

            router.back();
        } catch (error) {
            reportError(error, 'Failed to save the profile');
            Alert.alert(t('settings.profile.saveFailed', { ns: 'screens' }));
        }
    });

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.panel}>
                <VStack style={styles.field}>
                    <Label>{t('settings.profile.email', { ns: 'screens' })}</Label>
                    <Text fontSize="lg" fontWeight="semibold" style={styles.email}>
                        {session?.user.email ??
                            t('settings.account.signedIn.noEmail', { ns: 'screens' })}
                    </Text>
                    <Text fontSize="xs" style={styles.muted}>
                        {t('settings.profile.emailNote', { ns: 'screens' })}
                    </Text>
                </VStack>
            </VStack>

            <VStack style={styles.panel}>
                <Label>{t('onboarding.steps.about.title', { ns: 'screens' })}</Label>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.name', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="displayName"
                        valueType="text"
                        error={errors.displayName}
                    />
                </VStack>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.age', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="age"
                        valueType="number"
                        placeholder={String(MEDIAN_AGE_YEARS)}
                        error={errors.age}
                    />
                </VStack>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.sex', { ns: 'screens' })}</Label>
                    <Buttons
                        control={control}
                        name="biologicalSex"
                        choices={sexChoices}
                        error={errors.biologicalSex}
                    />
                </VStack>
            </VStack>

            <VStack style={styles.panel}>
                <Label>{t('onboarding.steps.body.title', { ns: 'screens' })}</Label>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.weight', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="bodyWeightKg"
                        valueType="decimal"
                        placeholder={String(averages.bodyWeightKg)}
                        error={errors.bodyWeightKg}
                    />
                </VStack>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.height', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="heightCm"
                        valueType="decimal"
                        placeholder={String(averages.heightCm)}
                        error={errors.heightCm}
                    />
                </VStack>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.somatotype', { ns: 'screens' })}</Label>
                    <Buttons
                        control={control}
                        name="somatotype"
                        choices={somatotypeChoices}
                        error={errors.somatotype}
                    />
                    <Text fontSize="2xs" style={styles.hint}>
                        {t('onboarding.somatotypeHint', { ns: 'screens' })}
                    </Text>
                </VStack>
            </VStack>

            <VStack style={styles.panel}>
                <Label>{t('onboarding.steps.goal.title', { ns: 'screens' })}</Label>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.goal', { ns: 'screens' })}</Label>
                    <Buttons
                        control={control}
                        name="goal"
                        choices={goalChoices}
                        error={errors.goal}
                    />
                </VStack>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.targetWeight', { ns: 'screens' })}</Label>
                    {/* No hint: there is no world average for what someone wants
                        to weigh, and inventing one would be the app telling them
                        what to aim at. */}
                    <Input
                        control={control}
                        name="targetWeightKg"
                        valueType="decimal"
                        error={errors.targetWeightKg}
                    />
                </VStack>
            </VStack>

            <VStack style={styles.panel}>
                <Label>{t('onboarding.steps.training.title', { ns: 'screens' })}</Label>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.activity', { ns: 'screens' })}</Label>
                    <Buttons
                        control={control}
                        name="activityLevel"
                        choices={activityChoices}
                        error={errors.activityLevel}
                    />
                </VStack>

                <VStack style={styles.field}>
                    <Label>{t('onboarding.fields.sessions', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="sessionsPerWeek"
                        valueType="number"
                        placeholder={String(GUIDELINE_SESSIONS_PER_WEEK)}
                        error={errors.sessionsPerWeek}
                    />
                </VStack>
            </VStack>

            <Button
                title={t('settings.profile.save', { ns: 'screens' })}
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={onSubmit}
            />
        </ScrollView>
    );
};

const ProfileScreen = () => {
    const { user } = useUser();
    const { theme } = useUnistyles();
    const userId = user?.id;

    const { data: details } = useQuery({
        queryKey: ['settings', 'profile', userId],
        queryFn: () => readProfileDetails(userId!),
        enabled: !!userId,
    });

    // Three local SQLite reads, so this is a frame or two rather than a wait.
    if (!userId || !details) {
        return (
            <VStack style={styles.loading}>
                <ActivityIndicator color={theme.colors.typography} />
            </VStack>
        );
    }

    return <ProfileFormFields userId={userId} details={details} />;
};

export default ProfileScreen;
