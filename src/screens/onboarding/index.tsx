import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { Buttons } from '@/components/forms/fields/buttons';
import { useUser } from '@/hooks/use-user';
import { saveOnboardingAnswers, skipOnboarding } from '@/crud/onboarding';
import { reportError } from '@/services/error-reporting';

import { OnboardingStep } from './components/step';

const styles = StyleSheet.create((theme) => ({
    fieldContainer: {
        gap: theme.space(2),
    },
    hint: {
        color: theme.colors.neutral[400],
    },
}));

/**
 * Every field is optional.
 *
 * The assistant produces a better plan with more context, but a blank profile
 * still yields a usable one under general-population assumptions — so nothing
 * here blocks a user from getting into the app.
 */
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

type OnboardingForm = z.infer<typeof schema>;

const STEP_COUNT = 4;

/** Age is friendlier to answer than a date, so it is converted on save. */
const ageToBirthday = (age: number | null | undefined): Date | null => {
    if (typeof age !== 'number' || !Number.isFinite(age)) return null;

    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - Math.round(age));

    return birthday;
};

const OnboardingScreen = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { user } = useUser();
    const [stepIndex, setStepIndex] = useState(0);

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<OnboardingForm>({ resolver: zodResolver(schema) });

    const choices = useCallback(
        (group: string, values: readonly string[]) =>
            values.map((value) => ({
                value,
                title: t(`onboarding.${group}.${value}`, { ns: 'screens' }),
            })),
        [t],
    );

    const finish = useCallback(() => {
        // Replace rather than push: onboarding should not sit in the back stack.
        router.replace('/');
    }, []);

    const userId = user?.id;

    const onSubmit = handleSubmit(async (values) => {
        if (!userId) return finish();

        try {
            await saveOnboardingAnswers(userId, {
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

            finish();
        } catch (error) {
            reportError(error, 'Failed to save onboarding answers');
            Alert.alert(t('onboarding.saveFailed', { ns: 'screens' }));
        }
    });

    const handleSkip = useCallback(() => {
        if (!userId) return finish();

        // Skipping still records completion, so the questions are not asked again.
        skipOnboarding(userId)
            .catch((error) => reportError(error, 'Failed to skip onboarding'))
            .finally(finish);
    }, [finish, userId]);

    const goNext = useCallback(() => {
        if (stepIndex < STEP_COUNT - 1) {
            setStepIndex((index) => index + 1);
            return;
        }

        onSubmit();
    }, [onSubmit, stepIndex]);

    const goBack = useCallback(() => setStepIndex((index) => Math.max(0, index - 1)), []);

    const steps = useMemo(
        () => [
            {
                title: t('onboarding.steps.about.title', { ns: 'screens' }),
                subtitle: t('onboarding.steps.about.subtitle', { ns: 'screens' }),
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.name', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="displayName"
                                valueType="text"
                                error={errors.displayName}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.age', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="age"
                                valueType="number"
                                error={errors.age}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.sex', { ns: 'screens' })}</Label>
                            <Buttons
                                control={control}
                                name="biologicalSex"
                                choices={choices('sex', ['female', 'male', 'other'])}
                                error={errors.biologicalSex}
                            />
                        </VStack>
                    </>
                ),
            },
            {
                title: t('onboarding.steps.body.title', { ns: 'screens' }),
                subtitle: t('onboarding.steps.body.subtitle', { ns: 'screens' }),
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.weight', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="bodyWeightKg"
                                valueType="decimal"
                                error={errors.bodyWeightKg}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.height', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="heightCm"
                                valueType="decimal"
                                error={errors.heightCm}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.somatotype', { ns: 'screens' })}</Label>
                            <Buttons
                                control={control}
                                name="somatotype"
                                choices={choices('somatotype', [
                                    'ectomorph',
                                    'mesomorph',
                                    'endomorph',
                                ])}
                                error={errors.somatotype}
                            />
                            <Text fontSize="2xs" style={styles.hint}>
                                {t('onboarding.somatotypeHint', { ns: 'screens' })}
                            </Text>
                        </VStack>
                    </>
                ),
            },
            {
                title: t('onboarding.steps.goal.title', { ns: 'screens' }),
                subtitle: t('onboarding.steps.goal.subtitle', { ns: 'screens' }),
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.goal', { ns: 'screens' })}</Label>
                            <Buttons
                                control={control}
                                name="goal"
                                choices={choices('goal', ['lose', 'maintain', 'gain', 'recomp'])}
                                error={errors.goal}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.targetWeight', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="targetWeightKg"
                                valueType="decimal"
                                error={errors.targetWeightKg}
                            />
                        </VStack>
                    </>
                ),
            },
            {
                title: t('onboarding.steps.training.title', { ns: 'screens' }),
                subtitle: t('onboarding.steps.training.subtitle', { ns: 'screens' }),
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.activity', { ns: 'screens' })}</Label>
                            <Buttons
                                control={control}
                                name="activityLevel"
                                choices={choices('activity', [
                                    'sedentary',
                                    'light',
                                    'moderate',
                                    'active',
                                    'very_active',
                                ])}
                                error={errors.activityLevel}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.sessions', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="sessionsPerWeek"
                                valueType="number"
                                error={errors.sessionsPerWeek}
                            />
                        </VStack>
                    </>
                ),
            },
        ],
        [choices, control, errors, t],
    );

    const step = steps[stepIndex];
    const isLast = stepIndex === STEP_COUNT - 1;

    return (
        <OnboardingStep
            stepIndex={stepIndex}
            stepCount={STEP_COUNT}
            title={step.title}
            subtitle={step.subtitle}
            onNext={goNext}
            onBack={stepIndex > 0 ? goBack : undefined}
            onSkip={handleSkip}
            isSubmitting={isSubmitting}
            nextLabel={
                isLast
                    ? t('onboarding.save', { ns: 'screens' })
                    : t('onboarding.next', { ns: 'screens' })
            }
        >
            {step.content}
        </OnboardingStep>
    );
};

export default OnboardingScreen;
