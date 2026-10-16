import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Button } from '@/components/buttons/base';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { Title } from '@/components/typography/title';
import { toDateKey, useMealsForDate, useToggleMealItem } from '@/hooks/use-nutrition';

/**
 * Today's meals as a checklist, and the way into Nutrition.
 *
 * Each planned meal is one row; ticking it marks everything in it as eaten, the
 * same write the Nutrition screen makes (`useToggleMealItem`), so the two never
 * disagree about the day. With nothing planned it says how to start, and offers
 * the quiet outline button rather than a second filled one.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(4),
        gap: theme.space(3),
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    list: {
        gap: theme.space(1),
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.space(11),
    },
    rowText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    slot: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    },
    summary: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

export const NutritionCard: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { meals } = useMealsForDate(toDateKey(new Date()));
    const { mutate: toggleItem } = useToggleMealItem();

    const planned = meals.filter((entry) => entry.items.length > 0);

    return (
        <VStack style={styles.container}>
            <VStack style={{ gap: theme.space(1) }}>
                <Title type="h4">{t('home.meals.title', { ns: 'screens' })}</Title>
                {planned.length === 0 ? (
                    <Text style={styles.hint}>{t('home.meals.hint', { ns: 'screens' })}</Text>
                ) : null}
            </VStack>

            {planned.length > 0 ? (
                <VStack style={styles.list}>
                    {planned.map(({ meal, items }) => {
                        const eaten = items.every((item) => item.consumedAt != null);
                        const calories = items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
                        const slot = t(`diet.slots.${meal.slot}`, { ns: 'screens' });

                        return (
                            <Pressable
                                key={meal.id}
                                onPress={() =>
                                    items.forEach((item) =>
                                        toggleItem({ id: item.id, consumed: !eaten }),
                                    )
                                }
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: eaten }}
                                accessibilityLabel={slot}
                            >
                                <HStack style={styles.row}>
                                    <Icon
                                        name={eaten ? 'check-circle' : 'circle'}
                                        size={theme.space(6)}
                                        color={
                                            eaten
                                                ? theme.colors.brand[500]
                                                : theme.colors.mutedTypography
                                        }
                                    />
                                    <VStack style={styles.rowText}>
                                        <Text style={styles.slot}>{slot}</Text>
                                        <Text style={styles.summary} numberOfLines={1}>
                                            {items.map((item) => item.name).join(', ')}
                                            {calories > 0
                                                ? ` · ${t('diet.kcal', { ns: 'screens', value: Math.round(calories) })}`
                                                : ''}
                                        </Text>
                                    </VStack>
                                </HStack>
                            </Pressable>
                        );
                    })}
                </VStack>
            ) : null}

            <Button
                type="outline"
                title={t('home.meals.log', { ns: 'screens' })}
                onPress={() => router.navigate('/diet')}
            />
        </VStack>
    );
};
