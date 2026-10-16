import { FC, useCallback, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import dayjs from 'dayjs';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { Separator } from '@/components/layout/separator';
import { StatBlocks, type StatBlock } from '@/components/layout/stat-blocks';
import { Button } from '@/components/buttons/base';
import { MEAL_SLOTS, type MealSlot } from '@/db/schema';
import {
    nutritionBasis,
    toDateKey,
    useDayProgress,
    useDeleteMealItem,
    useMealsForDate,
    useToggleMealItem,
} from '@/hooks/use-nutrition';
import { useAiAvailable } from '@/hooks/use-ai';
import { useUser } from '@/hooks/use-user';
import { DayStrip } from '@/components/layout/day-strip';
import { useSynDraftStore } from '@/stores/syn-draft';

import { MacroBar } from './components/macro-bar';
import { DietHeader } from './components/header';
import { Icon } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...Platform.select({
            ios: theme.screenContentPadding('child'),
            // No navigation header above this screen; it clears the status bar itself.
            default: {
                paddingTop: rt.insets.top + theme.space(2),
                paddingBottom: theme.screenContentPadding('root').paddingBottom,
            },
        }),
        gap: theme.space(4),
    },
    header: {
        gap: theme.space(1),
    },
    muted: {
        color: Platform.select({
            ios: theme.colors.mutedTypography,
            default: theme.colors.neutral[400],
        }),
    },
    // A card on the page, like Home's. It used to be the page colour, so
    // nothing on this screen read as a card.
    panel: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(4),
        gap: theme.space(3),
    },
    dayTitleRow: {
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    dayTitle: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    todayLink: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    slotTitleRow: {
        alignItems: 'center',
        gap: theme.space(2.5),
    },
    slotGlyph: {
        height: theme.space(8),
        width: theme.space(8),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: 'rgba(251, 191, 36, 0.16)',
    },
    sectionLabel: {
        ...theme.typography.eyebrow,
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
        borderColor: consumed ? theme.colors.primary : theme.colors.border,
        backgroundColor: consumed ? theme.colors.primary : 'transparent',
    }),
    itemText: {
        flex: 1,
    },
    swap: {
        minHeight: 44,
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swapText: {
        color: theme.colors.brand[400],
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    // Planned but not yet eaten reads as pending rather than as a record.
    itemPending: {
        color: Platform.select({
            ios: theme.colors.mutedTypography,
            default: theme.colors.neutral[400],
        }),
    },
    itemQuantity: {
        color: Platform.select({
            ios: theme.colors.mutedTypography,
            default: theme.colors.neutral[400],
        }),
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
        paddingVertical: theme.space(8),
    },
    setupAction: {
        alignSelf: 'stretch',
        marginTop: theme.space(2),
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
}));

const DietScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();

    const { user } = useUser();
    const [dayOffset, setDayOffset] = useState(0);
    const date = useMemo(() => toDateKey(dayjs().add(dayOffset, 'day').toDate()), [dayOffset]);
    const selectDay = useCallback(
        (key: string) => setDayOffset(dayjs(key).diff(dayjs().startOf('day'), 'day')),
        [],
    );

    const { meals } = useMealsForDate(date);
    const progress = useDayProgress(meals);
    const { mutateAsync: toggleItem } = useToggleMealItem();
    const { mutateAsync: removeItem } = useDeleteMealItem();

    const aiAvailable = useAiAvailable();
    const setDraft = useSynDraftStore((state) => state.setDraft);

    // "Swap" hands the item to Syn as a question, so the change is a proposal the
    // person reads, not a silent edit to what they planned to eat.
    const handleSwap = useCallback(
        (name: string) => {
            setDraft(t('diet.swapDraft', { ns: 'screens', name }));
            router.navigate('/syn');
        },
        [setDraft, t],
    );

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

    // Targets when set, otherwise the day's own plan — see `nutritionBasis`.
    const basis = useMemo(() => nutritionBasis(progress), [progress]);

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

    // A plan is built through the meal-plan form, which shows the diet and
    // allergies it will respect and the build it uses before spending it.
    const handleBuildPlan = useCallback(() => {
        router.navigate({ pathname: '/coach/new', params: { kind: 'nutrition' } } as never);
    }, []);

    const planCta = aiAvailable ? (
        <Button
            title={t('diet.buildPlan', { ns: 'screens' })}
            type="primary"
            onPress={handleBuildPlan}
            accessibilityLabel={t('diet.buildPlan', { ns: 'screens' })}
        />
    ) : null;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <DietHeader />

            <DayStrip selected={date} onSelect={selectDay} firstWeekday={user?.firstWeekday || 2} />

            <HStack style={styles.dayTitleRow}>
                <Text style={styles.dayTitle} accessibilityRole="header">
                    {dayOffset === 0
                        ? t('diet.today', { ns: 'screens' })
                        : dayjs(date).format('dddd, D MMM')}
                </Text>
                {dayOffset !== 0 ? (
                    <Pressable
                        onPress={() => setDayOffset(0)}
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <Text style={styles.todayLink}>
                            {t('diet.backToToday', { ns: 'screens' })}
                        </Text>
                    </Pressable>
                ) : null}
            </HStack>

            {hasAnything ? (
                <>
                    {hasEaten ? (
                        <VStack style={styles.header}>
                            <Text style={styles.sectionLabel}>
                                {dayOffset === 0
                                    ? t('diet.eatenToday', { ns: 'screens' })
                                    : t('diet.eaten', { ns: 'screens' })}
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
                                    <HStack style={styles.slotTitleRow}>
                                        <Box style={styles.slotGlyph}>
                                            <Icon
                                                name="utensils"
                                                size={16}
                                                color={theme.colors.amber[400]}
                                            />
                                        </Box>
                                        <Title type="h6" accessibilityRole="header">
                                            {t(`diet.slots.${slot}`, { ns: 'screens' })}
                                        </Title>
                                    </HStack>
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
                                                        <Icon
                                                            name="check"
                                                            size={theme.space(3.5)}
                                                            color={Platform.select({
                                                                ios: theme.colors.typography,
                                                                default: theme.colors.neutral[950],
                                                            })}
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

                                            {aiAvailable && !consumed ? (
                                                <Pressable
                                                    style={styles.swap}
                                                    onPress={() => handleSwap(item.name)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`${t('diet.swap', { ns: 'screens' })}: ${item.name}`}
                                                >
                                                    <Text fontSize="sm" style={styles.swapText}>
                                                        {t('diet.swap', { ns: 'screens' })}
                                                    </Text>
                                                </Pressable>
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
                        <Icon name="utensils" size={theme.space(6)} color={theme.colors.primary} />
                    </Box>
                    <Title type="h6">{t('diet.empty.title', { ns: 'screens' })}</Title>
                    <Text fontSize="sm" style={styles.setupText}>
                        {aiAvailable
                            ? t('diet.empty.message', { ns: 'screens' })
                            : t('diet.empty.messageOffline', { ns: 'screens' })}
                    </Text>
                    <Box style={styles.setupAction}>{planCta}</Box>
                </VStack>
            )}
        </ScrollView>
    );
};

export default DietScreen;
