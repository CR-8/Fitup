import { FC, ReactNode, useState } from 'react';
import { Alert, Platform, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Button } from '@/components/buttons/base';
import { MenuPicker } from '@/components/forms/menu-picker';
import { Datetime } from '@/components/forms/fields/datetime';
import { NumericStepperField } from '@/components/primitives/numeric-stepper-field';
import { saveOnboardingAnswers } from '@/crud/onboarding';
import { useUser } from '@/hooks/use-user';
import { useAiProfile } from '@/hooks/use-ai';
import { useNotifications } from '@/hooks/use-notifications';
import { queryClient } from '@/queries';
import { reportError } from '@/services/error-reporting';
import { PeriodPicker, Ring } from '@/screens/home/components/charts';
import { ACCENT } from '@/screens/home/summary';

/**
 * First launch, after Apple Fitness's: Welcome (what the app does), Personalize
 * (birth date, sex, height, weight, so calories and heart-rate zones are right),
 * a daily calorie goal from how active you are, and the case for notifications.
 * Then Summary. Training plans are Syn's to build, from its own form.
 */

type Step = 'welcome' | 'personalize' | 'goal' | 'notifications';
const STEPS: Step[] = ['welcome', 'personalize', 'goal', 'notifications'];

type Sex = 'female' | 'male' | 'other';
type Level = 'light' | 'moderate' | 'active';
const LEVELS: Level[] = ['light', 'moderate', 'active'];
const LEVEL_FACTOR: Record<Level, number> = { light: 1.375, moderate: 1.55, active: 1.725 };
const LEVEL_DEFAULT: Record<Level, number> = { light: 1800, moderate: 2200, active: 2600 };

const LB_PER_KG = 2.20462;
const CM_PER_INCH = 2.54;

/**
 * A day's calories for the activity level: Mifflin-St Jeor resting energy times
 * the level's factor when the body is known, rounded to 50; a typical figure
 * for the level when it is not.
 */
const suggestCalories = (
    level: Level,
    kg: number | null,
    cm: number | null,
    age: number | null,
    sex: Sex | null,
) => {
    if (!kg || !cm || !age) return LEVEL_DEFAULT[level];
    const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
    const resting = 10 * kg + 6.25 * cm - 5 * age + offset;

    return Math.round((resting * LEVEL_FACTOR[level]) / 50) * 50;
};

const parse = (text: string) => {
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : null;
};

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flexGrow: 1,
        paddingTop: rt.insets.top + theme.space(12),
        paddingHorizontal: theme.space(6),
        paddingBottom: theme.space(6),
        gap: theme.space(6),
    },
    title: {
        fontSize: 32,
        lineHeight: 38,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
    },
    body: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
        marginTop: -theme.space(3),
    },
    rows: {
        gap: theme.space(7),
    },
    row: {
        alignItems: 'flex-start',
        gap: theme.space(4),
    },
    badge: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT.distance,
    },
    rowText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    rowTitle: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    rowBody: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    group: {
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    field: (first: boolean) => ({
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    }),
    fieldLabel: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    fieldInput: {
        ...theme.fontSize.default,
        flex: 1,
        textAlign: 'right',
        color: theme.colors.mutedTypography,
        paddingVertical: theme.space(3),
    },
    dateRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    unit: {
        ...theme.typography.eyebrow,
        textAlign: 'center',
        textTransform: 'uppercase',
        color: theme.colors.typography,
    },
    phone: {
        alignSelf: 'center',
        width: 220,
        height: 260,
        marginTop: -theme.space(4),
        paddingTop: theme.space(10),
        paddingHorizontal: theme.space(3),
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        borderWidth: 1.5,
        borderBottomWidth: 0,
        borderColor: theme.colors.neutral[600],
        backgroundColor: theme.colors.foreground,
        gap: theme.space(6),
        alignItems: 'center',
    },
    clock: {
        fontSize: 52,
        lineHeight: 60,
        color: theme.colors.neutral[300],
        ...theme.typography.metric,
    },
    banner: {
        alignSelf: 'stretch',
        alignItems: 'center',
        gap: theme.space(2.5),
        padding: theme.space(2.5),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.elevated,
    },
    bannerLines: {
        flex: 1,
        gap: theme.space(1.5),
    },
    bannerLine: (width: number | `${number}%`, strong: boolean) => ({
        height: 7,
        width,
        borderRadius: 4,
        backgroundColor: strong ? theme.colors.neutral[400] : theme.colors.neutral[600],
    }),
    footer: {
        paddingHorizontal: theme.space(6),
        paddingBottom: rt.insets.bottom + theme.space(3),
        paddingTop: theme.space(2),
    },
}));

const Feature: FC<{ icon: IconName | 'ring'; title: string; body: string }> = ({
    icon,
    title,
    body,
}) => (
    <HStack style={styles.row}>
        <Box style={styles.badge}>
            {icon === 'ring' ? (
                <Ring progress={0.75} color={ACCENT.distance} size={44} />
            ) : (
                <Icon name={icon} size={22} color="#08090b" />
            )}
        </Box>
        <VStack style={styles.rowText}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowBody}>{body}</Text>
        </VStack>
    </HStack>
);

const OnboardingScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const { save } = useAiProfile();
    const { requestPermissions } = useNotifications();

    const [step, setStep] = useState<Step>('welcome');
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState(user?.displayName ?? '');
    const [sex, setSex] = useState<Sex | 'unset'>(user?.biologicalSex ?? 'unset');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [level, setLevel] = useState<Level>('moderate');
    const [calories, setCalories] = useState<number | null>(null);

    const { control } = useForm<{ birthday: Date | null }>({
        defaultValues: { birthday: user?.birthday ?? null },
    });
    const birthday = useWatch({ control, name: 'birthday' });

    const imperialWeight = user?.bodyWeightUnits === 'lb';
    const imperialHeight = user?.measurementUnits === 'in';
    const kg = parse(weight) ? parse(weight)! / (imperialWeight ? LB_PER_KG : 1) : null;
    const cm = parse(height) ? parse(height)! * (imperialHeight ? CM_PER_INCH : 1) : null;
    const age = birthday ? dayjs().diff(birthday, 'year') : null;
    const suggested = suggestCalories(level, kg, cm, age, sex === 'unset' ? null : sex);
    const goal = calories ?? suggested;

    const next = () => setStep(STEPS[STEPS.indexOf(step) + 1]);

    const finish = async () => {
        if (!user?.id || saving) return;
        setSaving(true);
        requestPermissions();

        try {
            await saveOnboardingAnswers(user.id, {
                displayName: name,
                birthday,
                biologicalSex: sex === 'unset' ? null : sex,
                bodyWeightKg: kg,
                heightCm: cm,
                activityLevel: level,
            });
            await save({ dailyCalorieTarget: goal });
            await queryClient.invalidateQueries();
            router.replace('/');
        } catch (error) {
            reportError(error, 'Failed to save onboarding answers:');
            Alert.alert(t('onboarding.flow.saveFailed', { ns: 'screens' }));
            setSaving(false);
        }
    };

    const screens: Record<Step, { body: ReactNode; action: string; onPress: () => void }> = {
        welcome: {
            action: t('onboarding.flow.continue', { ns: 'screens' }),
            onPress: next,
            body: (
                <>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.flow.welcome.title', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.rows}>
                        <Feature
                            icon="ring"
                            title={t('onboarding.flow.welcome.activity.title', { ns: 'screens' })}
                            body={t('onboarding.flow.welcome.activity.body', { ns: 'screens' })}
                        />
                        <Feature
                            icon="sparkles"
                            title={t('onboarding.flow.welcome.syn.title', { ns: 'screens' })}
                            body={t('onboarding.flow.welcome.syn.body', { ns: 'screens' })}
                        />
                        <Feature
                            icon="trophy"
                            title={t('onboarding.flow.welcome.awards.title', { ns: 'screens' })}
                            body={t('onboarding.flow.welcome.awards.body', { ns: 'screens' })}
                        />
                    </VStack>
                </>
            ),
        },
        personalize: {
            action: t('onboarding.flow.continue', { ns: 'screens' }),
            onPress: next,
            body: (
                <>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.flow.personalize.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.body}>
                        {t('onboarding.flow.personalize.body', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.group}>
                        <HStack style={styles.field(true)}>
                            <Text style={styles.fieldLabel}>
                                {t('onboarding.flow.personalize.name', { ns: 'screens' })}
                            </Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={name}
                                onChangeText={setName}
                                placeholder={t('onboarding.flow.notSet', { ns: 'screens' })}
                                placeholderTextColor={theme.colors.mutedTypography}
                                maxLength={40}
                                autoCapitalize="words"
                                returnKeyType="done"
                            />
                        </HStack>
                        <Box style={styles.dateRow}>
                            <Datetime
                                control={control}
                                name="birthday"
                                title={t('onboarding.flow.personalize.birthday', { ns: 'screens' })}
                                maximumDate={dayjs().subtract(13, 'year').toDate()}
                                minimumDate={dayjs().subtract(100, 'year').toDate()}
                            />
                        </Box>
                        <HStack style={styles.field(false)}>
                            <Text style={styles.fieldLabel}>
                                {t('onboarding.flow.personalize.sex', { ns: 'screens' })}
                            </Text>
                            <MenuPicker
                                value={sex}
                                options={(['unset', 'female', 'male', 'other'] as const).map(
                                    (value) => ({
                                        value,
                                        label:
                                            value === 'unset'
                                                ? t('onboarding.flow.notSet', { ns: 'screens' })
                                                : t(`onboarding.flow.sex.${value}`, {
                                                      ns: 'screens',
                                                  }),
                                    }),
                                )}
                                onChange={setSex}
                                accessibilityLabel={t('onboarding.flow.personalize.sex', {
                                    ns: 'screens',
                                })}
                            />
                        </HStack>
                        <HStack style={styles.field(false)}>
                            <Text style={styles.fieldLabel}>
                                {t('onboarding.flow.personalize.height', {
                                    ns: 'screens',
                                    unit: imperialHeight ? 'in' : 'cm',
                                })}
                            </Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={height}
                                onChangeText={setHeight}
                                placeholder={t('onboarding.flow.notSet', { ns: 'screens' })}
                                placeholderTextColor={theme.colors.mutedTypography}
                                keyboardType="decimal-pad"
                                maxLength={5}
                            />
                        </HStack>
                        <HStack style={styles.field(false)}>
                            <Text style={styles.fieldLabel}>
                                {t('onboarding.flow.personalize.weight', {
                                    ns: 'screens',
                                    unit: imperialWeight ? 'lb' : 'kg',
                                })}
                            </Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={weight}
                                onChangeText={setWeight}
                                placeholder={t('onboarding.flow.notSet', { ns: 'screens' })}
                                placeholderTextColor={theme.colors.mutedTypography}
                                keyboardType="decimal-pad"
                                maxLength={5}
                            />
                        </HStack>
                    </VStack>
                </>
            ),
        },
        goal: {
            action: t('onboarding.flow.goal.set', { ns: 'screens' }),
            onPress: next,
            body: (
                <>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.flow.goal.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.body}>
                        {t('onboarding.flow.goal.body', { ns: 'screens' })}
                    </Text>
                    <PeriodPicker
                        labels={LEVELS.map((value) =>
                            t(`onboarding.flow.goal.levels.${value}`, { ns: 'screens' }),
                        )}
                        index={LEVELS.indexOf(level)}
                        onChange={(index) => {
                            setLevel(LEVELS[index]);
                            setCalories(null);
                        }}
                    />
                    <VStack style={{ gap: theme.space(3), paddingTop: theme.space(8) }}>
                        <NumericStepperField
                            value={goal}
                            unit=""
                            onChange={setCalories}
                            modalTitle={t('onboarding.flow.goal.title', { ns: 'screens' })}
                            step={50}
                            min={1000}
                            max={6000}
                        />
                        <Text style={styles.unit}>
                            {t('calories.goal.unit', { ns: 'screens' })}
                        </Text>
                    </VStack>
                </>
            ),
        },
        notifications: {
            action: t('onboarding.flow.continue', { ns: 'screens' }),
            onPress: () => void finish(),
            body: (
                <>
                    <VStack style={styles.phone}>
                        <Text style={styles.clock}>9:41</Text>
                        <HStack style={styles.banner}>
                            <Ring progress={0.8} color={ACCENT.distance} size={34} />
                            <VStack style={styles.bannerLines}>
                                <Box style={styles.bannerLine('45%', true)} />
                                <Box style={styles.bannerLine('100%', false)} />
                                <Box style={styles.bannerLine('80%', false)} />
                            </VStack>
                        </HStack>
                    </VStack>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.flow.notifications.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.body}>
                        {t('onboarding.flow.notifications.body', { ns: 'screens' })}
                    </Text>
                </>
            ),
        },
    };

    const current = screens[step];

    return (
        <Box style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
                {current.body}
            </ScrollView>
            <Box style={styles.footer}>
                <Button
                    title={current.action}
                    loading={saving}
                    disabled={saving}
                    onPress={current.onPress}
                />
            </Box>
        </Box>
    );
};

export default OnboardingScreen;
