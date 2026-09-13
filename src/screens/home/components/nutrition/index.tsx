import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Apple, ChevronRight } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { useAiAvailable } from '@/hooks/use-ai';
import { nutritionBasis, toDateKey, useDayProgress, useMealsForDate } from '@/hooks/use-nutrition';
import { MacroBar } from '@/screens/diet/components/macro-bar';

/**
 * Today's eating at a glance, and the way into Nutrition.
 *
 * Nutrition has no tab, so this card is its door on Home. It replaces a row of
 * three shortcut tiles, two of which only repeated the tab bar. The figures are
 * the Nutrition screen's own — same hooks, same basis — so the two never
 * disagree about the day.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(5),
        gap: theme.space(4),
    },
    header: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    headerText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    badge: {
        height: theme.space(11),
        width: theme.space(11),
        borderRadius: theme.radius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    eyebrow: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    panel: {
        gap: theme.space(3),
    },
    macroRow: {
        gap: theme.space(4),
    },
    muted: {
        color: theme.colors.mutedTypography,
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

export const NutritionCard: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const aiAvailable = useAiAvailable();

    const { meals } = useMealsForDate(toDateKey(new Date()));
    const progress = useDayProgress(meals);
    const basis = nutritionBasis(progress);

    return (
        <Pressable
            style={styles.container}
            onPress={() => router.navigate('/diet')}
            accessibilityRole="button"
            accessibilityLabel={t('diet.title', { ns: 'screens' })}
        >
            <HStack style={styles.header}>
                <Box style={styles.badge}>
                    <Apple size={theme.space(5.5)} strokeWidth={2} color={theme.colors.primary} />
                </Box>
                <VStack style={styles.headerText}>
                    <Text style={styles.eyebrow}>{t('diet.today', { ns: 'screens' })}</Text>
                    <Title type="h4">{t('diet.title', { ns: 'screens' })}</Title>
                </VStack>
                <ChevronRight size={theme.space(5)} color={theme.colors.mutedTypography} />
            </HStack>

            {progress.counts.total > 0 ? (
                <VStack style={styles.panel}>
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
                    <Text fontSize="2xs" style={styles.muted}>
                        {t('diet.itemsEaten', {
                            ns: 'screens',
                            consumed: progress.counts.consumed,
                            total: progress.counts.total,
                        })}
                    </Text>
                </VStack>
            ) : (
                <Text style={styles.hint}>
                    {t(aiAvailable ? 'diet.empty.message' : 'diet.empty.messageOffline', {
                        ns: 'screens',
                    })}
                </Text>
            )}
        </Pressable>
    );
};
