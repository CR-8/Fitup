import { FC, useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { Check, ChevronLeft, ChevronRight, Sparkles, UtensilsCrossed } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { Separator } from '@/components/layout/separator';
import { StatBlocks, type StatBlock } from '@/components/layout/stat-blocks';
import { BackButton } from '@/components/buttons/back';
import { Button } from '@/components/buttons/base';
import { MEAL_SLOTS, type MealSlot } from '@/db/schema';
import {
    toDateKey,
    useDayProgress,
    useDeleteMealItem,
    useMealsForDate,
    useToggleMealItem,
} from '@/hooks/use-nutrition';
import { useAiAvailable, useAiChat, useAiConversation, useAiQuota } from '@/hooks/use-ai';

import { MacroBar } from './components/macro-bar';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(4),
    },
    // The screen is presented as a card with the native header switched off, so
    // the only way back was the swipe gesture. The shared back button is the
    // same control every other pushed screen uses.
    topRow: {
        alignItems: 'center',
    },
    header: {
        gap: theme.space(1),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    dayRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    dayButton: {
        height: theme.space(9),
        width: theme.space(9),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.foreground,
    },
    dayLabel: {
        alignItems: 'center',
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
    sectionLabel: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    macroRow: {
        gap: theme.space(4),
    },
    slotHeader: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    slotMeta: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    itemRow: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingVertical: theme.space(1),
    },
    tick: (consumed: boolean) => ({
        height: theme.space(6),
        width: theme.space(6),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: consumed ? theme.colors.brand[500] : theme.colors.border,
        backgroundColor: consumed ? theme.colors.brand[500] : 'transparent',
    }),
    itemText: {
        flex: 1,
    },
    // Planned but not yet eaten reads as pending rather than as a record.
    itemPending: {
        color: theme.colors.neutral[400],
    },
    itemQuantity: {
        color: theme.colors.neutral[400],
    },
    /**
     * The setup state.
     *
     * Before a chart exists this screen used to open on four zeroes and a
     * bare "nothing logged" line — the same broken-looking emptiness the
     * Results radars had. It now says what the screen is for and offers the one
     * action that fills it.
     */
    setup: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    setupIcon: {
        height: theme.space(12),
        width: theme.space(12),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    setupText: {
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    // Matches the accent CTA on the home card rather than the app's default
    // black/white button, since this is the screen's primary action.
    cta: {
        backgroundColor: theme.colors.brand[600],
    },
    ctaText: {
        color: theme.colors.white,
    },
}));

const DietScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();

    const [dayOffset, setDayOffset] = useState(0);
    const date = useMemo(() => toDateKey(dayjs().add(dayOffset, 'day').toDate()), [dayOffset]);

    const { meals } = useMealsForDate(date);
    const progress = useDayProgress(meals);
    const { mutateAsync: toggleItem } = useToggleMealItem();
    const { mutateAsync: removeItem } = useDeleteMealItem();

    // The same nutrition generation Tony already exposes — reused here rather
    // than rebuilt, so a plan built from this screen lands in the one
    // conversation and applies through the one code path.
    const aiAvailable = useAiAvailable();
    const { conversation } = useAiConversation();
    const { generatePlan, isBusy } = useAiChat(conversation?.id);
    const quota = useAiQuota();
    const quotaExhausted = quota.remaining <= 0;

    const bySlot = useMemo(() => {
        const grouped: Record<string, (typeof meals)[number]['items']> = {};

        for (const entry of meals) {
            grouped[entry.meal.slot] = [...(grouped[entry.meal.slot] ?? []), ...entry.items];
        }

        return grouped;
    }, [meals]);

    const hasAnything = progress.counts.total > 0;
    const hasEaten = progress.counts.consumed > 0;

    /**
     * What was actually eaten, shown only once something has been.
     *
     * Rendering these before the first item is ticked would put four zeroes at
     * the top of the screen, which says nothing true that the progress panel
     * below does not already say better.
     */
    const consumedBlocks = useMemo<StatBlock[]>(
        () => [
            {
                key: 'calories',
                value: String(Math.round(progress.consumed.calories)),
                label: t('diet.calories', { ns: 'screens' }),
                emphasised: true,
            },
            {
                key: 'protein',
                value: `${Math.round(progress.consumed.proteinG)}g`,
                label: t('diet.protein', { ns: 'screens' }),
            },
            {
                key: 'carbs',
                value: `${Math.round(progress.consumed.carbsG)}g`,
                label: t('diet.carbs', { ns: 'screens' }),
            },
            {
                key: 'fat',
                value: `${Math.round(progress.consumed.fatG)}g`,
                label: t('diet.fat', { ns: 'screens' }),
            },
        ],
        [progress.consumed, t],
    );

    /**
     * Progress is measured against the day's own plan.
     *
     * The profile carries daily macro targets and they are preferred when set,
     * but nothing in the app writes them today — so the honest denominator is
     * what the chart laid out for the day, and the caption says so rather than
     * presenting a plan as a health target.
     */
    const basis = useMemo(() => {
        const hasTargets =
            typeof progress.targets.calories === 'number' && progress.targets.calories > 0;

        return {
            hasTargets,
            calories: hasTargets ? progress.targets.calories : progress.planned.calories,
            proteinG: hasTargets ? progress.targets.proteinG : progress.planned.proteinG,
            carbsG: hasTargets ? progress.targets.carbsG : progress.planned.carbsG,
            fatG: hasTargets ? progress.targets.fatG : progress.planned.fatG,
        };
    }, [progress.planned, progress.targets]);

    const caloriesRemaining = Math.max(
        0,
        Math.round(progress.planned.calories - progress.consumed.calories),
    );

    const handleRemove = useCallback(
        (id: string, name: string) => {
            Alert.alert(t('diet.removeTitle', { ns: 'screens' }), name, [
                { text: t('diet.cancel', { ns: 'screens' }), style: 'cancel' },
                {
                    text: t('diet.remove', { ns: 'screens' }),
                    style: 'destructive',
                    onPress: () => {
                        removeItem(id).catch(() => undefined);
                    },
                },
            ]);
        },
        [removeItem, t],
    );

    /**
     * Builds a chart through the existing plan pipeline, then hands over to
     * Tony, which is where a plan draft is reviewed and applied. Applying it
     * writes real meals back into this screen.
     */
    const handleBuildPlan = useCallback(async () => {
        if (quotaExhausted) {
            Alert.alert(
                t('tony.quota.title', { ns: 'screens' }),
                t('tony.quota.message', { ns: 'screens', limit: quota.limit }),
            );

            return;
        }

        try {
            await generatePlan({
                kind: 'nutrition',
                intent: t('tony.actions.nutritionIntent', { ns: 'screens' }),
            });
        } catch {
            // The failure is written into the conversation as an assistant turn,
            // so Tony is still the right place to land.
        }

        router.navigate('/tony');
    }, [generatePlan, quota.limit, quotaExhausted, t]);

    const planCta = aiAvailable ? (
        <Button
            title={t('diet.buildPlan', { ns: 'screens' })}
            onPress={handleBuildPlan}
            disabled={isBusy}
            loading={isBusy}
            spinnerColor={theme.colors.white}
            containerStyle={styles.cta}
            textStyle={styles.ctaText}
            prefix={
                isBusy ? undefined : (
                    <Sparkles size={theme.space(4.5)} color={theme.colors.white} strokeWidth={2} />
                )
            }
            accessibilityLabel={t('diet.buildPlan', { ns: 'screens' })}
        />
    ) : null;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <HStack style={styles.topRow}>
                <BackButton onPressHandler={() => router.back()} />
            </HStack>

            <VStack style={styles.header}>
                <Title type="h1">{t('diet.title', { ns: 'screens' })}</Title>
                <Text style={styles.subtitle}>{t('diet.subtitle', { ns: 'screens' })}</Text>
            </VStack>

            <HStack style={styles.dayRow}>
                <Pressable
                    style={styles.dayButton}
                    onPress={() => setDayOffset((value) => value - 1)}
                    accessibilityLabel={t('diet.previousDay', { ns: 'screens' })}
                >
                    <ChevronLeft size={theme.space(4)} color={theme.colors.typography} />
                </Pressable>

                <VStack style={styles.dayLabel}>
                    <Text fontSize="sm" fontWeight="semibold">
                        {dayOffset === 0
                            ? t('diet.today', { ns: 'screens' })
                            : dayjs(date).format('ddd, D MMM')}
                    </Text>
                    {dayOffset !== 0 ? (
                        <Text fontSize="2xs" style={styles.muted}>
                            {dayjs(date).format('YYYY')}
                        </Text>
                    ) : null}
                </VStack>

                <Pressable
                    style={styles.dayButton}
                    onPress={() => setDayOffset((value) => value + 1)}
                    accessibilityLabel={t('diet.nextDay', { ns: 'screens' })}
                >
                    <ChevronRight size={theme.space(4)} color={theme.colors.typography} />
                </Pressable>
            </HStack>

            {hasAnything ? (
                <>
                    {hasEaten ? (
                        <VStack style={styles.header}>
                            <Text style={styles.sectionLabel}>
                                {t('diet.eatenToday', { ns: 'screens' })}
                            </Text>
                            <StatBlocks blocks={consumedBlocks} inset={false} />
                        </VStack>
                    ) : null}

                    <VStack style={styles.panel}>
                        <Text style={styles.sectionLabel}>
                            {basis.hasTargets
                                ? t('diet.againstTarget', { ns: 'screens' })
                                : t('diet.againstPlan', { ns: 'screens' })}
                        </Text>

                        <MacroBar
                            label={t('diet.calories', { ns: 'screens' })}
                            consumed={progress.consumed.calories}
                            target={basis.calories}
                        />
                        <HStack style={styles.macroRow}>
                            <MacroBar
                                label={t('diet.protein', { ns: 'screens' })}
                                consumed={progress.consumed.proteinG}
                                target={basis.proteinG}
                                unit="g"
                            />
                            <MacroBar
                                label={t('diet.carbs', { ns: 'screens' })}
                                consumed={progress.consumed.carbsG}
                                target={basis.carbsG}
                                unit="g"
                            />
                            <MacroBar
                                label={t('diet.fat', { ns: 'screens' })}
                                consumed={progress.consumed.fatG}
                                target={basis.fatG}
                                unit="g"
                            />
                        </HStack>

                        <Separator />

                        {/* Both figures are counted from the day's own rows. */}
                        <Text fontSize="2xs" style={styles.muted}>
                            {t('diet.itemsEaten', {
                                ns: 'screens',
                                consumed: progress.counts.consumed,
                                total: progress.counts.total,
                            })}
                            {caloriesRemaining > 0
                                ? ` · ${t('diet.plannedRemaining', {
                                      ns: 'screens',
                                      value: caloriesRemaining,
                                  })}`
                                : ''}
                        </Text>
                    </VStack>

                    {MEAL_SLOTS.map((slot: MealSlot) => {
                        const items = bySlot[slot] ?? [];
                        if (items.length === 0) return null;

                        const slotCalories = Math.round(
                            items.reduce((totals, item) => totals + (item.calories ?? 0), 0),
                        );
                        const slotEaten = items.filter((item) => item.consumedAt != null).length;

                        return (
                            <VStack key={slot} style={styles.panel}>
                                <HStack style={styles.slotHeader}>
                                    <Title type="h6">
                                        {t(`diet.slots.${slot}`, { ns: 'screens' })}
                                    </Title>
                                    <HStack style={styles.slotMeta}>
                                        <Text fontSize="2xs" style={styles.muted}>
                                            {t('diet.itemsEaten', {
                                                ns: 'screens',
                                                consumed: slotEaten,
                                                total: items.length,
                                            })}
                                        </Text>
                                        {slotCalories > 0 ? (
                                            <Text fontSize="2xs" style={styles.muted}>
                                                {t('diet.kcal', {
                                                    ns: 'screens',
                                                    value: slotCalories,
                                                })}
                                            </Text>
                                        ) : null}
                                    </HStack>
                                </HStack>

                                <Separator />

                                {items.map((item) => {
                                    const consumed = item.consumedAt != null;

                                    return (
                                        <HStack key={item.id} style={styles.itemRow}>
                                            <Pressable
                                                onPress={() =>
                                                    toggleItem({
                                                        id: item.id,
                                                        consumed: !consumed,
                                                    }).catch(() => undefined)
                                                }
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: consumed }}
                                                accessibilityLabel={item.name}
                                                hitSlop={8}
                                            >
                                                <Box style={styles.tick(consumed)}>
                                                    {consumed ? (
                                                        <Check
                                                            size={theme.space(3.5)}
                                                            strokeWidth={3}
                                                            color={theme.colors.neutral[950]}
                                                        />
                                                    ) : null}
                                                </Box>
                                            </Pressable>

                                            <Pressable
                                                style={styles.itemText}
                                                onLongPress={() => handleRemove(item.id, item.name)}
                                            >
                                                <Text
                                                    fontSize="sm"
                                                    style={
                                                        consumed ? undefined : styles.itemPending
                                                    }
                                                >
                                                    {item.name}
                                                </Text>
                                                {item.quantity ? (
                                                    <Text
                                                        fontSize="2xs"
                                                        style={styles.itemQuantity}
                                                    >
                                                        {item.quantity}
                                                    </Text>
                                                ) : null}
                                            </Pressable>

                                            {item.calories ? (
                                                <Text fontSize="2xs" style={styles.muted}>
                                                    {t('diet.kcal', {
                                                        ns: 'screens',
                                                        value: Math.round(item.calories),
                                                    })}
                                                </Text>
                                            ) : null}
                                        </HStack>
                                    );
                                })}
                            </VStack>
                        );
                    })}

                    {planCta}
                </>
            ) : (
                <VStack style={[styles.panel, styles.setup]}>
                    <Box style={styles.setupIcon}>
                        <UtensilsCrossed
                            size={theme.space(6)}
                            color={theme.colors.primary}
                            strokeWidth={2}
                        />
                    </Box>
                    <Title type="h6">{t('diet.empty.title', { ns: 'screens' })}</Title>
                    <Text fontSize="sm" style={styles.setupText}>
                        {aiAvailable
                            ? t('diet.empty.message', { ns: 'screens' })
                            : t('diet.empty.messageOffline', { ns: 'screens' })}
                    </Text>
                    {planCta}
                </VStack>
            )}
        </ScrollView>
    );
};

export default DietScreen;
