import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell, Scale, Target, User } from 'lucide-react-native';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { Buttons } from '@/components/forms/fields/buttons';
import { useUser } from '@/hooks/use-user';
import { saveOnboardingAnswers, skipOnboarding } from '@/crud/onboarding';
import { GUIDELINE_SESSIONS_PER_WEEK, MEDIAN_AGE_YEARS, worldAverages } from '@/constants/averages';
import { queryClient } from '@/queries';
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

/**
 * What the form starts as.
 *
 * Split deliberately, because "sensible default" and "sensible hint" are not the
 * same thing here — a default is saved, a hint is not:
 *
 *   - `goal`, `activityLevel` and `sessionsPerWeek` are plain profile settings
 *     with a defensible middle, and they are what the plan generator reads. A
 *     user who taps straight through now arrives with a usable profile instead
 *     of three nulls.
 *   - `bodyWeightKg` and `heightCm` are NOT defaulted. They are written as
 *     `measurement` rows, which are a time series, so a number nobody typed
 *     would show up on the weight chart as a real weigh-in.
 *   - `age` is NOT defaulted either. It is saved as a birthday, and the birthday
 *     is what heart-rate zones are derived from — a guessed age silently
 *     produces wrong zones, which is worse than having none.
 *   - `biologicalSex` and `somatotype` are self-descriptions. There is no
 *     neutral value to pick on someone's behalf.
 *
 * Passing this object also stops every field starting as `undefined`, which is
 * what left the inputs switching from uncontrolled to controlled on first edit.
 */
const DEFAULT_VALUES: OnboardingForm = {
    displayName: null,
    age: null,
    biologicalSex: null,
    bodyWeightKg: null,
    heightCm: null,
    targetWeightKg: null,
    goal: 'maintain',
    somatotype: null,
    activityLevel: 'moderate',
    sessionsPerWeek: GUIDELINE_SESSIONS_PER_WEEK,
};

/**
 * Which step each field is asked on.
 *
 * Needed because the last step's Save runs `handleSubmit` over the whole form:
 * a field left in a state zod rejects — an age of 5, say — aborted the submit
 * with the error rendered on a step nobody could see, so the button simply did
 * nothing. This is the map back to it.
 */
const STEP_FIELDS: readonly (keyof OnboardingForm)[][] = [
    ['displayName', 'age', 'biologicalSex'],
    ['bodyWeightKg', 'heightCm', 'somatotype'],
    ['goal', 'targetWeightKg'],
    ['activityLevel', 'sessionsPerWeek'],
];

const STEP_COUNT = STEP_FIELDS.length;

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
    } = useForm<OnboardingForm>({
        resolver: zodResolver(schema),
        defaultValues: DEFAULT_VALUES,
    });

    /**
     * Hints, not values. Nothing here is ever saved — body weight and height are
     * written as `measurement` rows, so a number the user did not type would
     * appear on their weight chart as a real reading.
     *
     * They follow the answer to "biological sex", which is asked on the step
     * before the body questions. No guard is needed against overwriting typed
     * input: a placeholder is only visible while the field is empty.
     */
    const biologicalSex = useWatch({ control, name: 'biologicalSex' });
    const averages = worldAverages(biologicalSex);

    /**
     * A target weight is only meaningful next to the current one, so the hint
     * follows what was entered on the previous step and falls back to the
     * average only while that is still blank.
     */
    const bodyWeightKg = useWatch({ control, name: 'bodyWeightKg' });
    const targetWeightHint = bodyWeightKg ?? averages.bodyWeightKg;

    const choices = useCallback(
        (group: string, values: readonly string[]) =>
            values.map((value) => ({
                value,
                title: t(`onboarding.${group}.${value}`, { ns: 'screens' }),
            })),
        [t],
    );

    const finish = useCallback(() => {
        // `useFirstLaunchGate` caches this answer with `staleTime: Infinity`, so
        // without an explicit invalidation it keeps reporting "not onboarded" for
        // the rest of the launch — and sends the user back here the next time it
        // re-evaluates, which is every time the session changes.
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'completed'] });

        // Replace rather than push: onboarding should not sit in the back stack.
        router.replace('/');
    }, []);

    const userId = user?.id;

    const onSubmit = handleSubmit(
        async (values) => {
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
        },
        // Send the user to the answer that is holding up the save, rather than
        // leaving them tapping a button that has nothing to say.
        (formErrors) => {
            const step = STEP_FIELDS.findIndex((fields) =>
                fields.some((field) => formErrors[field]),
            );

            if (step >= 0) setStepIndex(step);
        },
    );

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
                motivation: t('onboarding.steps.about.motivation', { ns: 'screens' }),
                icon: User,
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
                                placeholder={String(MEDIAN_AGE_YEARS)}
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
                motivation: t('onboarding.steps.body.motivation', { ns: 'screens' }),
                icon: Scale,
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.weight', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="bodyWeightKg"
                                valueType="decimal"
                                placeholder={String(averages.bodyWeightKg)}
                                error={errors.bodyWeightKg}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label>{t('onboarding.fields.height', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="heightCm"
                                valueType="decimal"
                                placeholder={String(averages.heightCm)}
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
                motivation: t('onboarding.steps.goal.motivation', { ns: 'screens' }),
                icon: Target,
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
                                placeholder={String(targetWeightHint)}
                                error={errors.targetWeightKg}
                            />
                        </VStack>
                    </>
                ),
            },
            {
                title: t('onboarding.steps.training.title', { ns: 'screens' }),
                subtitle: t('onboarding.steps.training.subtitle', { ns: 'screens' }),
                motivation: t('onboarding.steps.training.motivation', { ns: 'screens' }),
                icon: Dumbbell,
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
                                placeholder={String(GUIDELINE_SESSIONS_PER_WEEK)}
                                error={errors.sessionsPerWeek}
                            />
                        </VStack>
                    </>
                ),
            },
        ],
        [averages, choices, control, errors, t, targetWeightHint],
    );

    const step = steps[stepIndex];
    const isLast = stepIndex === STEP_COUNT - 1;

    return (
        <OnboardingStep
            stepIndex={stepIndex}
            stepCount={STEP_COUNT}
            title={step.title}
            subtitle={step.subtitle}
            motivation={step.motivation}
            icon={step.icon}
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
