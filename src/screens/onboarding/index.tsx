import { FC, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { Buttons } from '@/components/forms/fields/buttons';
import { useUser } from '@/hooks/use-user';
import { readProfileDetails, saveOnboardingAnswers, type ProfileDetails } from '@/crud/onboarding';
import { GUIDELINE_SESSIONS_PER_WEEK, MEDIAN_AGE_YEARS, worldAverages } from '@/constants/averages';
import { queryClient } from '@/queries';
import { reportError } from '@/services/error-reporting';
import { ageToBirthday, birthdayToAge } from '@/helpers/profile';

import { OnboardingStep } from './components/step';
import { profileResolver, type ProfileFormData, type ProfileFormValues } from './schema';
import type { IconName } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme) => ({
    fieldContainer: {
        gap: theme.space(2),
    },
    hint: {
        color: Platform.select({
            ios: theme.colors.mutedTypography,
            default: theme.colors.neutral[400],
        }),
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

type OnboardingForm = ProfileFormValues;

/**
 * What the form starts as: whatever the profile already holds, and nothing else.
 *
 * Every required answer starts blank rather than at a "sensible middle". A
 * preselected goal or training place could be tapped straight past, which is
 * the same as skipping it — and sign-up is not allowed to finish with a
 * question nobody answered (see `REQUIRED_PROFILE_FIELDS`).
 *
 * The profile is read first because this screen is not only for new accounts.
 * The first-launch gate also sends back anyone whose profile is missing a
 * required answer — accounts from when onboarding could be skipped, mostly — and
 * they should only have to fill in the gaps. Body weight and height may already
 * be there from a health-platform import.
 *
 * Hints are still placeholders, never values: weight and height are written as
 * `measurement` rows, so a number nobody typed would show up on the weight chart
 * as a real weigh-in, and a guessed age silently produces wrong heart-rate zones.
 */
const toFormValues = (details: ProfileDetails | undefined): OnboardingForm => ({
    displayName: details?.displayName ?? null,
    age: birthdayToAge(details?.birthday ?? null),
    biologicalSex: details?.biologicalSex ?? null,
    bodyWeightKg: details?.bodyWeightKg ?? null,
    heightCm: details?.heightCm ?? null,
    targetWeightKg: details?.targetWeightKg ?? null,
    goal: details?.goal ?? null,
    somatotype: details?.somatotype ?? null,
    activityLevel: details?.activityLevel ?? null,
    sessionsPerWeek: details?.sessionsPerWeek ?? null,
    trainingEnvironment: details?.trainingEnvironment ?? null,
});

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
    ['activityLevel', 'sessionsPerWeek', 'trainingEnvironment'],
];

const STEP_COUNT = STEP_FIELDS.length;

interface OnboardingFormProps {
    userId: string | undefined;
    initialValues: OnboardingForm;
}

/**
 * Split from the screen so the fields mount with the stored answers already in
 * hand — `BaseInput` reads its value once, on mount. See the same split in
 * Settings → Profile.
 */
const AboutYouForm: FC<OnboardingFormProps> = ({ userId, initialValues }) => {
    const { t } = useTranslation(['screens', 'common']);
    const [stepIndex, setStepIndex] = useState(0);

    const {
        control,
        handleSubmit,
        trigger,
        formState: { errors, isSubmitting },
    } = useForm<OnboardingForm, unknown, ProfileFormData>({
        resolver: profileResolver,
        defaultValues: initialValues,
        mode: 'onTouched',
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

    const onSubmit = handleSubmit(
        async (values) => {
            if (!userId) return finish();

            try {
                await saveOnboardingAnswers(userId, {
                    displayName: values.displayName,
                    birthday: ageToBirthday(values.age),
                    biologicalSex: values.biologicalSex,
                    bodyWeightKg: values.bodyWeightKg,
                    heightCm: values.heightCm,
                    targetWeightKg: values.targetWeightKg ?? null,
                    goal: values.goal,
                    somatotype: values.somatotype ?? null,
                    activityLevel: values.activityLevel,
                    sessionsPerWeek: values.sessionsPerWeek,
                    trainingEnvironment: values.trainingEnvironment,
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

    /**
     * There is no way past a step with a required answer missing — no skip
     * link and no tapping through. Validating here, a step at a time, puts the
     * message under the field that needs it while it is still on screen,
     * rather than collecting every complaint at the final Save.
     */
    const goNext = useCallback(async () => {
        if (stepIndex < STEP_COUNT - 1) {
            const valid = await trigger(STEP_FIELDS[stepIndex]);

            if (valid) setStepIndex((index) => index + 1);
            return;
        }

        onSubmit();
    }, [onSubmit, stepIndex, trigger]);

    const goBack = useCallback(() => setStepIndex((index) => Math.max(0, index - 1)), []);

    const steps = useMemo(
        () => [
            {
                title: t('onboarding.steps.about.title', { ns: 'screens' }),
                subtitle: t('onboarding.steps.about.subtitle', { ns: 'screens' }),
                motivation: t('onboarding.steps.about.motivation', { ns: 'screens' }),
                icon: 'person' as IconName,
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label field>{t('onboarding.fields.name', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="displayName"
                                valueType="text"
                                error={errors.displayName}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label field>{t('onboarding.fields.age', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="age"
                                valueType="number"
                                placeholder={t('onboarding.example', {
                                    ns: 'screens',
                                    value: MEDIAN_AGE_YEARS,
                                })}
                                error={errors.age}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label field>{t('onboarding.fields.sex', { ns: 'screens' })}</Label>
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
                icon: 'scale' as IconName,
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label field>{t('onboarding.fields.weight', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="bodyWeightKg"
                                valueType="decimal"
                                placeholder={t('onboarding.example', {
                                    ns: 'screens',
                                    value: averages.bodyWeightKg,
                                })}
                                error={errors.bodyWeightKg}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label field>{t('onboarding.fields.height', { ns: 'screens' })}</Label>
                            <Input
                                control={control}
                                name="heightCm"
                                valueType="decimal"
                                placeholder={t('onboarding.example', {
                                    ns: 'screens',
                                    value: averages.heightCm,
                                })}
                                error={errors.heightCm}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label field>
                                {t('onboarding.optional', {
                                    ns: 'screens',
                                    label: t('onboarding.fields.somatotype', { ns: 'screens' }),
                                })}
                            </Label>
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
                icon: 'target' as IconName,
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label field>{t('onboarding.fields.goal', { ns: 'screens' })}</Label>
                            <Buttons
                                control={control}
                                name="goal"
                                choices={choices('goal', ['lose', 'maintain', 'gain', 'recomp'])}
                                error={errors.goal}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label field>
                                {t('onboarding.optional', {
                                    ns: 'screens',
                                    label: t('onboarding.fields.targetWeight', { ns: 'screens' }),
                                })}
                            </Label>
                            <Input
                                control={control}
                                name="targetWeightKg"
                                valueType="decimal"
                                placeholder={t('onboarding.example', {
                                    ns: 'screens',
                                    value: targetWeightHint,
                                })}
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
                icon: 'dumbbell' as IconName,
                content: (
                    <>
                        <VStack style={styles.fieldContainer}>
                            <Label field>
                                {t('onboarding.fields.activity', { ns: 'screens' })}
                            </Label>
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
                            <Label field>
                                {t('onboarding.fields.sessions', { ns: 'screens' })}
                            </Label>
                            <Input
                                control={control}
                                name="sessionsPerWeek"
                                valueType="number"
                                placeholder={t('onboarding.example', {
                                    ns: 'screens',
                                    value: GUIDELINE_SESSIONS_PER_WEEK,
                                })}
                                error={errors.sessionsPerWeek}
                            />
                        </VStack>

                        <VStack style={styles.fieldContainer}>
                            <Label field>
                                {t('onboarding.fields.trainingEnvironment', { ns: 'screens' })}
                            </Label>
                            <Buttons
                                control={control}
                                name="trainingEnvironment"
                                choices={choices('trainingEnvironment', ['home', 'gym'])}
                                error={errors.trainingEnvironment}
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

/**
 * The last step of signing up, and the screen the first-launch gate sends
 * anyone back to whose profile is missing a required answer.
 */
const OnboardingScreen = () => {
    const { user } = useUser();
    const { theme } = useUnistyles();
    const userId = user?.id;

    const { data: details, isLoading } = useQuery({
        queryKey: ['onboarding', 'details', userId],
        queryFn: () => readProfileDetails(userId!),
        enabled: !!userId,
    });

    if (userId && isLoading) {
        return (
            <Box style={styles.loading}>
                <ActivityIndicator color={theme.colors.primary} />
            </Box>
        );
    }

    return <AboutYouForm userId={userId} initialValues={toFormValues(details)} />;
};

export default OnboardingScreen;
