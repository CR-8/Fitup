import { FC, useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { HeaderTextButton } from '@/components/buttons/header';
import { Stack } from '@/navigators/stack';
import { AI_CONFIG } from '@/constants/ai';
import { MEAL_SLOTS, type MealSlot } from '@/db/schema';
import { useAccount } from '@/hooks/use-account';
import { useAiAvailable, useAiProfile, useSynActions } from '@/hooks/use-ai';
import { storage } from '@/storage';
import { ACCENT } from '@/screens/home/summary';
import { hasSeenSynWelcome } from '@/screens/syn-welcome';

import { HeaderArt } from '../build/components/header-art';
import { MenuPicker } from '../build/components/menu-picker';
import type { Diet } from './components/diet-fields';
import { MealIcon } from './components/meal-icon';

/**
 * Build Your Food Plan: the food chart's form, in Build Your Plan's style.
 * Which meals, for how long, the cuisine, cooking time and budget, the diet
 * and allergies, and a day's calories; Create sends Syn the whole brief, so it
 * writes the chart without asking, and the meals land in Nutrition at once.
 *
 * Diet, allergies and calories are saved to the profile; the rest is
 * remembered on this device for next time.
 */

const LIME = ACCENT.distance;
/** Syn writes a short rotation (output stays small) and the app repeats it. */
const CYCLE_DAYS = 3;
const LENGTHS = [3, 7, 14] as const;
const REGIONS = ['north', 'south', 'west', 'east', 'mixed'] as const;
const COOK_TIMES = [15, 30, 45] as const;
const BUDGETS = ['low', 'moderate', 'flexible'] as const;
const DIETS: Diet[] = [
    'vegetarian',
    'eggetarian',
    'omnivore',
    'vegan',
    'pescatarian',
    'halal',
    'kosher',
];
const ALLERGENS = [
    'peanuts',
    'tree nuts',
    'dairy',
    'gluten',
    'eggs',
    'soy',
    'fish',
    'shellfish',
    'sesame',
];
const CALORIES = [0, 1500, 1800, 2000, 2200, 2500, 2800, 3200] as const;

type Region = (typeof REGIONS)[number];
type Budget = (typeof BUDGETS)[number];

interface Draft {
    days: number;
    slots: MealSlot[];
    region: Region;
    cookMinutes: number;
    budget: Budget;
}

const DRAFT_KEY = 'coach.draft.food';
const DEFAULT_DRAFT: Draft = {
    days: 7,
    slots: ['breakfast', 'lunch', 'dinner'],
    region: 'north',
    cookMinutes: 30,
    budget: 'moderate',
};

const readDraft = (): Draft => {
    try {
        const raw = storage.getString(DRAFT_KEY);
        return raw ? { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : DEFAULT_DRAFT;
    } catch {
        return DEFAULT_DRAFT;
    }
};

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: '#1c1e22',
    },
    content: {
        paddingHorizontal: theme.space(4),
        paddingTop: Platform.OS === 'android' ? rt.insets.top : 0,
        paddingBottom: theme.space(32),
        gap: theme.space(3),
    },
    navRow: {
        height: 44,
        alignItems: 'center',
    },
    title: {
        fontSize: 30,
        lineHeight: 36,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
        marginBottom: theme.space(2),
    },
    section: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        marginTop: theme.space(4),
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        marginTop: -theme.space(2),
    },
    group: {
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.elevated,
        overflow: 'hidden',
    },
    row: (first: boolean) => ({
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    }),
    rowLabel: {
        ...theme.fontSize.default,
        flexShrink: 1,
        color: theme.colors.typography,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    tile: (selected: boolean, wide: boolean) => ({
        width: wide ? '48.8%' : '31.8%',
        minHeight: wide ? 88 : 56,
        justifyContent: wide ? 'space-between' : 'center',
        padding: theme.space(3),
        borderRadius: theme.radius.xl,
        borderWidth: 1.5,
        borderColor: selected ? LIME : 'transparent',
        backgroundColor: theme.colors.elevated,
    }),
    tileText: (selected: boolean) => ({
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? LIME : theme.colors.typography,
    }),
    caution: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
        marginTop: theme.space(2),
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: theme.space(2),
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(3),
        backgroundColor: 'rgba(28, 30, 34, 0.94)',
    },
    footerText: {
        ...theme.fontSize.sm,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
}));

const FoodPlanScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const available = useAiAvailable();
    const { isSignedIn } = useAccount();
    const { profile, save } = useAiProfile();
    const { generate, quota, exhausted, isBusy } = useSynActions();

    const [draft, setDraftState] = useState<Draft>(readDraft);
    const [dietDraft, setDiet] = useState<Diet | null>(null);
    const [allergenDraft, setAllergens] = useState<string[] | null>(null);
    const [caloriesDraft, setCalories] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const diet = dietDraft ?? profile?.dietaryPattern ?? 'vegetarian';
    const allergens = allergenDraft ?? profile?.allergens ?? [];
    const calories = caloriesDraft ?? profile?.dailyCalorieTarget ?? 0;

    const setDraft = (updates: Partial<Draft>) =>
        setDraftState((current) => {
            const next = { ...current, ...updates };
            try {
                storage.set(DRAFT_KEY, JSON.stringify(next));
            } catch {
                // A form that cannot be remembered still works.
            }
            return next;
        });

    const signInNeeded = AI_CONFIG.transport === 'proxy' && !isSignedIn;
    const canCreate =
        available &&
        !signInNeeded &&
        !exhausted &&
        !isBusy &&
        !submitting &&
        draft.slots.length > 0;

    const toggleSlot = (slot: MealSlot) =>
        setDraft({
            slots: draft.slots.includes(slot)
                ? draft.slots.filter((s) => s !== slot)
                : MEAL_SLOTS.filter((s) => s === slot || draft.slots.includes(s)),
        });

    const toggleAllergen = (allergen: string) =>
        setAllergens(
            allergens.includes(allergen)
                ? allergens.filter((a) => a !== allergen)
                : [...allergens, allergen],
        );

    const create = async () => {
        if (!canCreate) return;
        setSubmitting(true);

        try {
            await save({
                dietaryPattern: diet,
                allergens,
                ...(calories > 0 ? { dailyCalorieTarget: calories } : {}),
            });
        } catch {
            // The brief carries every answer anyway.
        }

        const cycle = Math.min(draft.days, CYCLE_DAYS);
        const intent = [
            `A ${cycle}-day food chart that I will rotate for ${draft.days} days.`,
            `Meals each day, and only these: ${draft.slots.join(', ')}.`,
            `Cuisine: ${draft.region === 'mixed' ? 'mixed Indian regions' : `${draft.region} Indian`}.`,
            `Cooking time: about ${draft.cookMinutes} minutes a meal. Budget: ${draft.budget}.`,
            `Diet: ${diet}. Allergies: ${allergens.length ? allergens.join(', ') : 'none'}.`,
            calories > 0
                ? `Daily calories: about ${calories} kcal.`
                : `Daily calories: set them from my goal${profile?.goal ? ` (${profile.goal})` : ''}.`,
            'This is everything you need. Do not ask questions; write the chart.',
        ].join('\n');

        const started = generate('nutrition', intent, cycle, {
            repeatDays: draft.days,
            ready: true,
            autoApply: true,
        });
        setSubmitting(false);
        if (started) router.back();
    };

    const navButton = (
        <HeaderTextButton title={t('cancel', { ns: 'common' })} onPress={() => router.back()} />
    );

    // Syn's AI caution comes before its first use on this device.
    useEffect(() => {
        if (!hasSeenSynWelcome()) router.navigate('/syn-welcome' as never);
    }, []);

    return (
        <Box style={styles.container}>
            {Platform.OS === 'ios' ? (
                <Stack.Screen options={{ title: '', headerLeft: () => navButton }} />
            ) : null}

            <ScrollView
                contentContainerStyle={styles.content}
                contentInsetAdjustmentBehavior="automatic"
            >
                {Platform.OS === 'android' ? (
                    <HStack style={styles.navRow}>{navButton}</HStack>
                ) : null}
                <HeaderArt />
                <Text style={styles.title} accessibilityRole="header">
                    {t('coach.food.title', { ns: 'screens' })}
                </Text>

                <Text style={styles.section}>{t('coach.food.meals', { ns: 'screens' })}</Text>
                <Box style={styles.grid}>
                    {MEAL_SLOTS.map((slot) => {
                        const selected = draft.slots.includes(slot);
                        return (
                            <Pressable
                                key={slot}
                                style={styles.tile(selected, true)}
                                onPress={() => toggleSlot(slot)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected }}
                            >
                                <MealIcon
                                    slot={slot}
                                    size={22}
                                    color={selected ? LIME : '#9a9fa8'}
                                />
                                <Text style={styles.tileText(selected)}>
                                    {t(`syn.plan.slots.${slot}`, { ns: 'screens' })}
                                </Text>
                            </Pressable>
                        );
                    })}
                </Box>

                <VStack style={styles.group}>
                    <HStack style={styles.row(true)}>
                        <Text style={styles.rowLabel}>
                            {t('coach.food.length', { ns: 'screens' })}
                        </Text>
                        <MenuPicker
                            value={draft.days}
                            options={LENGTHS.map((value) => ({
                                value,
                                label: t('coach.food.daysValue', { ns: 'screens', count: value }),
                            }))}
                            onChange={(days) => setDraft({ days })}
                            accessibilityLabel={t('coach.food.length', { ns: 'screens' })}
                        />
                    </HStack>
                    <HStack style={styles.row(false)}>
                        <Text style={styles.rowLabel}>
                            {t('coach.food.calories', { ns: 'screens' })}
                        </Text>
                        <MenuPicker
                            value={calories}
                            options={CALORIES.map((value) => ({
                                value,
                                label: value
                                    ? t('coach.food.kcalValue', { ns: 'screens', value })
                                    : t('coach.food.fromGoal', { ns: 'screens' }),
                            }))}
                            onChange={setCalories}
                            accessibilityLabel={t('coach.food.calories', { ns: 'screens' })}
                        />
                    </HStack>
                    <HStack style={styles.row(false)}>
                        <Text style={styles.rowLabel}>
                            {t('coach.new.region', { ns: 'screens' })}
                        </Text>
                        <MenuPicker
                            value={draft.region}
                            options={REGIONS.map((value) => ({
                                value,
                                label: t(`coach.new.regions.${value}`, { ns: 'screens' }),
                            }))}
                            onChange={(region) => setDraft({ region })}
                            accessibilityLabel={t('coach.new.region', { ns: 'screens' })}
                        />
                    </HStack>
                    <HStack style={styles.row(false)}>
                        <Text style={styles.rowLabel}>
                            {t('coach.new.cooking', { ns: 'screens' })}
                        </Text>
                        <MenuPicker
                            value={draft.cookMinutes}
                            options={COOK_TIMES.map((value) => ({
                                value,
                                label: t('coach.new.cookingValue', { ns: 'screens', count: value }),
                            }))}
                            onChange={(cookMinutes) => setDraft({ cookMinutes })}
                            accessibilityLabel={t('coach.new.cooking', { ns: 'screens' })}
                        />
                    </HStack>
                    <HStack style={styles.row(false)}>
                        <Text style={styles.rowLabel}>
                            {t('coach.new.budget', { ns: 'screens' })}
                        </Text>
                        <MenuPicker
                            value={draft.budget}
                            options={BUDGETS.map((value) => ({
                                value,
                                label: t(`coach.new.budgets.${value}`, { ns: 'screens' }),
                            }))}
                            onChange={(budget) => setDraft({ budget })}
                            accessibilityLabel={t('coach.new.budget', { ns: 'screens' })}
                        />
                    </HStack>
                </VStack>

                <Text style={styles.section}>{t('coach.new.diet', { ns: 'screens' })}</Text>
                <Box style={styles.grid}>
                    {DIETS.map((value) => (
                        <Pressable
                            key={value}
                            style={styles.tile(diet === value, false)}
                            onPress={() => setDiet(value)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: diet === value }}
                        >
                            <Text style={styles.tileText(diet === value)} numberOfLines={1}>
                                {t(`coach.new.diets.${value}`, { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    ))}
                </Box>

                <Text style={styles.section}>{t('coach.new.allergies', { ns: 'screens' })}</Text>
                <Text style={styles.hint}>{t('coach.food.allergiesHint', { ns: 'screens' })}</Text>
                <Box style={styles.grid}>
                    {ALLERGENS.map((value) => {
                        const selected = allergens.includes(value);
                        return (
                            <Pressable
                                key={value}
                                style={styles.tile(selected, false)}
                                onPress={() => toggleAllergen(value)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected }}
                            >
                                <Text style={styles.tileText(selected)} numberOfLines={1}>
                                    {t(`coach.new.allergens.${value.replace(' ', '_')}`, {
                                        ns: 'screens',
                                    })}
                                </Text>
                            </Pressable>
                        );
                    })}
                </Box>

                <Text style={styles.caution}>{t('coach.new.mealCaution', { ns: 'screens' })}</Text>
            </ScrollView>

            <VStack style={styles.footer}>
                <Text style={styles.footerText}>
                    {!available
                        ? t('syn.unavailable.message', { ns: 'screens' })
                        : signInNeeded
                          ? t('syn.signInRequired.message', { ns: 'screens' })
                          : exhausted
                            ? t('coach.new.usedUp', { ns: 'screens', limit: quota.limit })
                            : isBusy
                              ? t('coach.new.busy', { ns: 'screens' })
                              : t('coach.new.cost', { ns: 'screens', count: quota.remaining })}
                </Text>
                {signInNeeded ? (
                    <Button
                        type="primary"
                        title={t('syn.signInRequired.action', { ns: 'screens' })}
                        onPress={() => router.navigate('/sign-in')}
                    />
                ) : (
                    <Button
                        type="primary"
                        title={t('coach.food.create', { ns: 'screens' })}
                        disabled={!canCreate}
                        loading={submitting}
                        onPress={() => void create()}
                    />
                )}
            </VStack>
        </Box>
    );
};

export default FoodPlanScreen;
