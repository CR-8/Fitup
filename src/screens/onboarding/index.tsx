import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Label } from '@/components/forms/label';
import { Input } from '@/components/forms/fields/input';
import { Buttons } from '@/components/forms/fields/buttons';
import { SegmentedTabs } from '@/components/forms/segmented-tabs';
import { UnitInput } from '@/components/forms/unit-input';
import { useUser } from '@/hooks/use-user';
import {
    useAiAvailable,
    useAiChat,
    useAiConversation,
    useAiProfile,
    useAiQuota,
    useApplyAiPlan,
} from '@/hooks/use-ai';
import { saveOnboardingAnswers, skipOnboarding } from '@/crud/onboarding';
import { GUIDELINE_SESSIONS_PER_WEEK, MEDIAN_AGE_YEARS, worldAverages } from '@/constants/averages';
import type { AiPlanSelect } from '@/db/schema';
import { convertWeight } from '@/helpers/units';
import { queryClient } from '@/queries';
import { reportError } from '@/services/error-reporting';
import { useAiProgressStore } from '@/stores/ai-progress';
import type { IconName } from '@/components/primitives/icon';
import { DietFields, type DietAnswers } from '@/screens/coach/new/components/diet-fields';

import { OnboardingStep } from './components/step';
import { GoalCard } from './components/goal-card';
import { Stepper } from './components/stepper';
import { Generation } from './components/generation';
import { PlanPreview } from './components/plan-preview';
import { profileSchema, type ProfileFormData } from './schema';

const styles = StyleSheet.create((theme) => ({
    fieldContainer: {
        gap: theme.space(2),
    },
    cards: {
        gap: theme.space(3),
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

type OnboardingForm = ProfileFormData;

/**
 * The four goals the screen offers, and the schema value each one saves.
 *
 * "Build muscle" and "Get stronger" both save `gain`: the profile has one
 * progressive-overload goal, and the plan generator is told the wording the
 * person chose through the intent it is sent. The choice itself is screen state;
 * only the enum is stored.
 */
const GOALS: readonly {
    key: 'build' | 'lose' | 'stronger' | 'fitness';
    goal: NonNullable<OnboardingForm['goal']>;
    icon: IconName;
}[] = [
    { key: 'build', goal: 'gain', icon: 'dumbbell' },
    { key: 'lose', goal: 'lose', icon: 'flame' },
    { key: 'stronger', goal: 'gain', icon: 'trending-up' },
    { key: 'fitness', goal: 'maintain', icon: 'heart' },
];

type GoalKey = (typeof GOALS)[number]['key'];

/**
 * What the form starts as.
 *
 * Split deliberately, because "sensible default" and "sensible hint" are not the
 * same thing here: a default is saved, a hint is not.
 *
 *   - `goal`, `activityLevel` and `sessionsPerWeek` are plain profile settings
 *     with a defensible middle, and they are what the plan generator reads. A
 *     user who taps straight through arrives with a usable profile instead of
 *     three nulls.
 *   - `bodyWeightKg` and `heightCm` are NOT defaulted. They are written as
 *     `measurement` rows, which are a time series, so a number nobody typed
 *     would show up on the weight chart as a real weigh-in.
 *   - `age` is NOT defaulted either. It is saved as a birthday, and the birthday
 *     is what heart-rate zones are derived from, so a guessed age silently
 *     produces wrong zones.
 *   - `biologicalSex` is a self-description. There is no neutral value to pick
 *     on someone's behalf.
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
    sessionsPerWeek: Math.round(GUIDELINE_SESSIONS_PER_WEEK),
    // Gym preserves prior behaviour (no equipment filtering) for anyone who
    // taps straight through; home is an active, narrowing choice.
    trainingEnvironment: 'gym',
};

/**
 * Which step each field is asked on.
 *
 * Needed because the last step's button runs `handleSubmit` over the whole form:
 * a field left in a state zod rejects (an age of 5, say) aborted the submit with
 * the error rendered on a step nobody could see. This is the map back to it.
 */
const STEP_FIELDS: readonly (keyof OnboardingForm)[][] = [
    ['displayName', 'age', 'biologicalSex', 'bodyWeightKg', 'heightCm'],
    ['goal'],
    ['activityLevel', 'sessionsPerWeek', 'trainingEnvironment'],
    // Diet is kept outside the form: nothing on that step can fail validation.
    [],
];

const STEP_COUNT = STEP_FIELDS.length;

/** Age is friendlier to answer than a date, so it is converted on save. */
const ageToBirthday = (age: number | null | undefined): Date | null => {
    if (typeof age !== 'number' || !Number.isFinite(age)) return null;

    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - Math.round(age));

    return birthday;
};

const CM_PER_INCH = 2.54;

type Phase = 'form' | 'generating' | 'preview' | 'failed';

const OnboardingScreen = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { user } = useUser();
    const [stepIndex, setStepIndex] = useState(0);
    const [phase, setPhase] = useState<Phase>('form');
    const [plan, setPlan] = useState<AiPlanSelect | null>(null);
    const [goalKey, setGoalKey] = useState<GoalKey | null>(null);
    const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>(user?.weightUnits ?? 'kg');
    const [heightUnit, setHeightUnit] = useState<'cm' | 'in'>('cm');
    const [dietAnswers, setDietAnswers] = useState<DietAnswers>({});

    const aiAvailable = useAiAvailable();
    const { conversation } = useAiConversation();
    const quota = useAiQuota();
    const { generatePlan } = useAiChat(conversation?.id);
    const { apply, isApplying } = useApplyAiPlan();
    const { save: saveDiet } = useAiProfile();

    const {
        control,
        handleSubmit,
        setValue,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<OnboardingForm>({
        resolver: zodResolver(profileSchema),
        defaultValues: DEFAULT_VALUES,
    });

    /**
     * Hints, not values. Nothing here is ever saved. They follow the answer to
     * "sex", which is asked on the same step: a placeholder is only visible while
     * the field is empty, so no guard is needed against overwriting typed input.
     */
    const biologicalSex = useWatch({ control, name: 'biologicalSex' });
    const bodyWeightKg = useWatch({ control, name: 'bodyWeightKg' });
    const heightCm = useWatch({ control, name: 'heightCm' });
    const sessionsPerWeek = useWatch({ control, name: 'sessionsPerWeek' });
    const trainingEnvironment = useWatch({ control, name: 'trainingEnvironment' });
    const averages = worldAverages(biologicalSex);

    const finish = useCallback(() => {
        // `useFirstLaunchGate` caches this answer with `staleTime: Infinity`, so
        // without an explicit invalidation it keeps reporting "not onboarded" for
        // the rest of the launch, and sends the user back here the next time it
        // re-evaluates, which is every time the session changes.
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'completed'] });

        // Replace rather than push: onboarding should not sit in the back stack.
        router.replace('/');
    }, []);

    const userId = user?.id;
    const goalTitle = goalKey ? t(`onboarding.goals.${goalKey}.title`, { ns: 'screens' }) : '';
    const canBuildPlan = aiAvailable && quota.remaining > 0;

    const build = useCallback(async () => {
        useAiProgressStore.setState({ cancelled: false });
        setPhase('generating');

        try {
            const result = await generatePlan({
                kind: 'workout',
                horizonDays: 28,
                intent: t('onboarding.plan.intent', {
                    ns: 'screens',
                    goal: goalTitle || t('onboarding.goals.fitness.title', { ns: 'screens' }),
                    days: getValues('sessionsPerWeek') ?? DEFAULT_VALUES.sessionsPerWeek,
                }),
            });

            if (useAiProgressStore.getState().cancelled) return;

            if (result) {
                setPlan(result);
                setPhase('preview');
            } else {
                // Syn asked a question or declined: no plan to preview.
                setPhase('failed');
            }
        } catch {
            if (!useAiProgressStore.getState().cancelled) setPhase('failed');
        }
    }, [generatePlan, getValues, goalTitle, t]);

    const cancel = useCallback(() => {
        useAiProgressStore.getState().cancel();
        setPhase('form');
        setStepIndex(STEP_COUNT - 1);
    }, []);

    const applyPlan = useCallback(async () => {
        if (!plan) return finish();

        try {
            await apply({ plan });
            finish();
        } catch (error) {
            reportError(error, 'Failed to apply the onboarding plan');
            Alert.alert(t('syn.plan.applyFailed', { ns: 'screens' }));
        }
    }, [apply, finish, plan, t]);

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
                    goal:
                        (goalKey ? GOALS.find((goal) => goal.key === goalKey)?.goal : null) ??
                        values.goal ??
                        null,
                    somatotype: values.somatotype ?? null,
                    activityLevel: values.activityLevel ?? null,
                    sessionsPerWeek: values.sessionsPerWeek ?? null,
                    trainingEnvironment: values.trainingEnvironment ?? null,
                });

                // Optional: left blank, both stay unknown rather than "no restrictions".
                const { dietaryPattern, allergens } = dietAnswers;
                if (dietaryPattern || allergens?.length) {
                    await saveDiet({
                        dietaryPattern: dietaryPattern ?? null,
                        allergens: allergens?.length ? allergens : null,
                    });
                }

                // With Syn available the next screens build a first plan; without
                // it (no AI host, or no builds left) the answers are all there is.
                if (canBuildPlan) void build();
                else finish();
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

    const choices = (group: string, values: readonly string[]) =>
        values.map((value) => ({
            value,
            title: t(`onboarding.${group}.${value}`, { ns: 'screens' }),
        }));

    if (phase === 'generating') return <Generation onCancel={cancel} />;

    if (phase === 'preview' && plan) {
        return (
            <PlanPreview
                plan={plan}
                goalLabel={goalTitle}
                regenerationsLeft={quota.remaining}
                busy={isApplying}
                onUse={() => void applyPlan()}
                onRegenerate={() => void build()}
            />
        );
    }

    if (phase === 'failed') {
        return (
            <OnboardingStep
                stepIndex={STEP_COUNT - 1}
                stepCount={STEP_COUNT}
                title={t('onboarding.generating.failedTitle', { ns: 'screens' })}
                subtitle={t('onboarding.generating.failedBody', { ns: 'screens' })}
                onNext={() => void build()}
                onSkip={finish}
                nextLabel={t('onboarding.generating.retry', { ns: 'screens' })}
            >
                <Text style={styles.hint}>
                    {t('onboarding.generating.failedHint', { ns: 'screens' })}
                </Text>
            </OnboardingStep>
        );
    }

    const isLast = stepIndex === STEP_COUNT - 1;
    const nextLabel = isLast
        ? t(canBuildPlan ? 'onboarding.buildPlan' : 'onboarding.save', { ns: 'screens' })
        : t('onboarding.next', { ns: 'screens' });

    const stepKey = ['profile', 'goal', 'schedule', 'diet'][stepIndex];

    return (
        <OnboardingStep
            stepIndex={stepIndex}
            stepCount={STEP_COUNT}
            title={t(`onboarding.steps.${stepKey}.title`, { ns: 'screens' })}
            subtitle={t(`onboarding.steps.${stepKey}.subtitle`, { ns: 'screens' })}
            onNext={goNext}
            onBack={stepIndex > 0 ? goBack : undefined}
            onSkip={handleSkip}
            isSubmitting={isSubmitting}
            nextLabel={nextLabel}
        >
            {stepIndex === 0 ? (
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
                        <Label field>{t('onboarding.fields.sex', { ns: 'screens' })}</Label>
                        <SegmentedTabs
                            value={biologicalSex ?? ''}
                            onChange={(value) =>
                                setValue('biologicalSex', value as OnboardingForm['biologicalSex'])
                            }
                            segments={choices('sex', ['male', 'female', 'other']).map(
                                ({ value, title }) => ({ value, title }),
                            )}
                            accessibilityLabel={t('onboarding.fields.sex', { ns: 'screens' })}
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
                        <Label field>{t('onboarding.fields.height', { ns: 'screens' })}</Label>
                        <UnitInput
                            key={`height-${heightUnit}`}
                            value={heightCm}
                            unit={heightUnit}
                            onUnitChange={setHeightUnit}
                            units={[
                                { value: 'cm', title: 'cm' },
                                { value: 'in', title: 'in' },
                            ]}
                            toDisplay={(value, unit) =>
                                unit === 'in' ? value / CM_PER_INCH : value
                            }
                            fromDisplay={(value, unit) =>
                                unit === 'in' ? value * CM_PER_INCH : value
                            }
                            onChange={(value) =>
                                setValue('heightCm', value, { shouldValidate: true })
                            }
                            placeholder={t('onboarding.example', {
                                ns: 'screens',
                                value:
                                    heightUnit === 'in'
                                        ? Math.round(averages.heightCm / CM_PER_INCH)
                                        : averages.heightCm,
                            })}
                            error={
                                errors.heightCm?.message
                                    ? t(errors.heightCm.message, { ns: 'common' })
                                    : undefined
                            }
                            accessibilityLabel={t('onboarding.fields.height', { ns: 'screens' })}
                        />
                    </VStack>

                    <VStack style={styles.fieldContainer}>
                        <Label field>{t('onboarding.fields.weight', { ns: 'screens' })}</Label>
                        <UnitInput
                            key={`weight-${weightUnit}`}
                            value={bodyWeightKg}
                            unit={weightUnit}
                            onUnitChange={setWeightUnit}
                            units={[
                                { value: 'kg', title: 'kg' },
                                { value: 'lb', title: 'lb' },
                            ]}
                            toDisplay={(value, unit) => convertWeight(value, 'kg', unit)}
                            fromDisplay={(value, unit) => convertWeight(value, unit, 'kg')}
                            onChange={(value) =>
                                setValue('bodyWeightKg', value, { shouldValidate: true })
                            }
                            placeholder={t('onboarding.example', {
                                ns: 'screens',
                                value: Math.round(
                                    convertWeight(averages.bodyWeightKg, 'kg', weightUnit),
                                ),
                            })}
                            error={
                                errors.bodyWeightKg?.message
                                    ? t(errors.bodyWeightKg.message, { ns: 'common' })
                                    : undefined
                            }
                            accessibilityLabel={t('onboarding.fields.weight', { ns: 'screens' })}
                        />
                    </VStack>
                </>
            ) : null}

            {stepIndex === 1 ? (
                <VStack style={styles.cards} accessibilityRole="radiogroup">
                    {GOALS.map((goal) => (
                        <GoalCard
                            key={goal.key}
                            icon={goal.icon}
                            title={t(`onboarding.goals.${goal.key}.title`, { ns: 'screens' })}
                            hint={t(`onboarding.goals.${goal.key}.hint`, { ns: 'screens' })}
                            selected={goalKey === goal.key}
                            onPress={() => {
                                setGoalKey(goal.key);
                                setValue('goal', goal.goal);
                            }}
                        />
                    ))}
                </VStack>
            ) : null}

            {stepIndex === 2 ? (
                <>
                    <VStack style={styles.fieldContainer}>
                        <Label field>{t('onboarding.fields.sessions', { ns: 'screens' })}</Label>
                        <Stepper
                            value={sessionsPerWeek ?? DEFAULT_VALUES.sessionsPerWeek ?? 3}
                            min={1}
                            max={7}
                            onChange={(value) => setValue('sessionsPerWeek', value)}
                            label={t('onboarding.fields.sessions', { ns: 'screens' })}
                        />
                    </VStack>

                    <VStack style={styles.fieldContainer}>
                        <Label field>
                            {t('onboarding.fields.trainingEnvironment', { ns: 'screens' })}
                        </Label>
                        <VStack style={styles.cards} accessibilityRole="radiogroup">
                            {(['gym', 'home'] as const).map((environment) => (
                                <GoalCard
                                    key={environment}
                                    icon={environment === 'gym' ? 'dumbbell' : 'home'}
                                    title={t(`onboarding.trainingEnvironment.${environment}`, {
                                        ns: 'screens',
                                    })}
                                    hint={t(`onboarding.environmentHint.${environment}`, {
                                        ns: 'screens',
                                    })}
                                    selected={trainingEnvironment === environment}
                                    onPress={() => setValue('trainingEnvironment', environment)}
                                />
                            ))}
                        </VStack>
                    </VStack>

                    <VStack style={styles.fieldContainer}>
                        <Label field>{t('onboarding.fields.activity', { ns: 'screens' })}</Label>
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
                </>
            ) : null}

            {stepIndex === 3 ? (
                <>
                    <DietFields
                        diet={dietAnswers.dietaryPattern ?? null}
                        allergens={dietAnswers.allergens ?? []}
                        onChange={(updates) =>
                            setDietAnswers((current) => ({ ...current, ...updates }))
                        }
                    />

                    {/* A07: the cost is said before the button that spends it. */}
                    {canBuildPlan ? (
                        <Text style={styles.hint}>
                            {t('coach.new.cost', { ns: 'screens', count: quota.remaining })}
                        </Text>
                    ) : null}
                </>
            ) : null}
        </OnboardingStep>
    );
};

export default OnboardingScreen;
