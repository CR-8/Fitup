import { FC, useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { Separator } from '@/components/layout/separator';
import { MEAL_SLOTS, type MealSlot } from '@/db/schema';
import {
    toDateKey,
    useDayProgress,
    useDeleteMealItem,
    useMealsForDate,
    useToggleMealItem,
} from '@/hooks/use-nutrition';

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
    header: {
        gap: theme.space(1),
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
    muted: {
        color: theme.colors.neutral[400],
    },
    panel: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(4),
    },
    macroRow: {
        gap: theme.space(4),
    },
    slotHeader: {
        justifyContent: 'space-between',
        alignItems: 'center',
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
    empty: {
        gap: theme.space(2),
        paddingVertical: theme.space(4),
        alignItems: 'center',
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

    const bySlot = useMemo(() => {
        const grouped: Record<string, (typeof meals)[number]['items']> = {};

        for (const entry of meals) {
            grouped[entry.meal.slot] = [...(grouped[entry.meal.slot] ?? []), ...entry.items];
        }

        return grouped;
    }, [meals]);

    const hasAnything = meals.some((entry) => entry.items.length > 0);

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

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.header}>
                <Title type="h1">{t('diet.title', { ns: 'screens' })}</Title>
            </VStack>

            <HStack style={styles.dayRow}>
                <Pressable
                    style={styles.dayButton}
                    onPress={() => setDayOffset((value) => value - 1)}
                    accessibilityLabel={t('diet.previousDay', { ns: 'screens' })}
                >
                    <ChevronLeft size={theme.space(4)} color={theme.colors.typography} />
                </Pressable>

                <VStack style={{ alignItems: 'center' }}>
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

            <VStack style={styles.panel}>
                <MacroBar
                    label={t('diet.calories', { ns: 'screens' })}
                    consumed={progress.consumed.calories}
                    target={progress.targets.calories}
                />
                <HStack style={styles.macroRow}>
                    <MacroBar
                        label={t('diet.protein', { ns: 'screens' })}
                        consumed={progress.consumed.proteinG}
                        target={progress.targets.proteinG}
                        unit="g"
                    />
                    <MacroBar
                        label={t('diet.carbs', { ns: 'screens' })}
                        consumed={progress.consumed.carbsG}
                        target={progress.targets.carbsG}
                        unit="g"
                    />
                    <MacroBar
                        label={t('diet.fat', { ns: 'screens' })}
                        consumed={progress.consumed.fatG}
                        target={progress.targets.fatG}
                        unit="g"
                    />
                </HStack>

                {progress.planned.calories > progress.consumed.calories ? (
                    <Text fontSize="2xs" style={styles.muted}>
                        {t('diet.plannedRemaining', {
                            ns: 'screens',
                            value: Math.round(
                                progress.planned.calories - progress.consumed.calories,
                            ),
                        })}
                    </Text>
                ) : null}
            </VStack>

            {hasAnything ? (
                MEAL_SLOTS.map((slot: MealSlot) => {
                    const items = bySlot[slot] ?? [];
                    if (items.length === 0) return null;

                    return (
                        <VStack key={slot} style={styles.panel}>
                            <HStack style={styles.slotHeader}>
                                <Title type="h6">
                                    {t(`diet.slots.${slot}`, { ns: 'screens' })}
                                </Title>
                                <Text fontSize="2xs" style={styles.muted}>
                                    {t('diet.kcal', {
                                        ns: 'screens',
                                        value: Math.round(
                                            items.reduce(
                                                (total, item) => total + (item.calories ?? 0),
                                                0,
                                            ),
                                        ),
                                    })}
                                </Text>
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
                                        >
                                            <Box style={styles.tick(consumed)}>
                                                {consumed ? (
                                                    <Check
                                                        size={theme.space(3.5)}
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
                                                style={consumed ? undefined : styles.itemPending}
                                            >
                                                {item.quantity
                                                    ? `${item.name} · ${item.quantity}`
                                                    : item.name}
                                            </Text>
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
                })
            ) : (
                <VStack style={[styles.panel, styles.empty]}>
                    <Plus size={theme.space(6)} color={theme.colors.neutral[400]} />
                    <Title type="h6">{t('diet.empty.title', { ns: 'screens' })}</Title>
                    <Text fontSize="sm" style={[styles.muted, { textAlign: 'center' }]}>
                        {t('diet.empty.message', { ns: 'screens' })}
                    </Text>
                </VStack>
            )}
        </ScrollView>
    );
};

export default DietScreen;
