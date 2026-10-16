import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle } from '@/components/layout/card';
import { ProgressBar } from '@/components/feedback/progress-bar';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { formatGlasses, formatWater, useWaterDay, useWaterLogging } from '@/hooks/use-water';

/**
 * Today's water: glasses against the goal, and one tap to log a glass. The
 * tap shows on the card at once and offers Undo; the card opens the day.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
    },
    row: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    figures: {
        flex: 1,
        gap: theme.space(0.5),
    },
    valueRow: {
        alignItems: 'baseline',
        gap: theme.space(1),
    },
    value: {
        fontSize: 34,
        lineHeight: 38,
        color: theme.colors.hydration,
        ...theme.typography.metric,
    },
    unit: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    caption: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    add: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: theme.space(1.5),
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.hydrationSoft,
    },
    addText: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.hydration,
    },
    retry: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
}));

export const HydrationCard: FC<{ date: string }> = ({ date }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const water = useWaterDay(date);
    const { addWater } = useWaterLogging({ undoToast: true });

    const glasses = formatGlasses(water.glasses);
    const summary = t('hydration.glassesOf', {
        ns: 'screens',
        glasses,
        target: water.targetGlasses,
    });

    return (
        <Card
            style={styles.container}
            onPress={() => router.navigate('/hydration' as never)}
            accessibilityLabel={`${t('hydration.title', { ns: 'screens' })}, ${summary}`}
            accessibilityHint={t('hydration.openHint', { ns: 'screens' })}
        >
            <CardTitle
                icon="droplet"
                color={theme.colors.hydration}
                title={t('hydration.title', { ns: 'screens' })}
                chevron
            />

            {water.isError ? (
                <HStack style={styles.row}>
                    <Text style={styles.caption}>
                        {t('hydration.errors.load', { ns: 'screens' })}
                    </Text>
                    <Pressable onPress={() => water.refetch()} accessibilityRole="button">
                        <Text style={styles.retry}>{t('hydration.retry', { ns: 'screens' })}</Text>
                    </Pressable>
                </HStack>
            ) : (
                <>
                    <HStack style={styles.row}>
                        <VStack style={styles.figures}>
                            <HStack style={styles.valueRow}>
                                <Text style={styles.value}>{water.isLoading ? '–' : glasses}</Text>
                                <Text style={styles.unit}>
                                    {t('hydration.ofGlasses', {
                                        ns: 'screens',
                                        count: water.targetGlasses,
                                    })}
                                </Text>
                            </HStack>
                            <Text style={styles.caption}>
                                {t('hydration.mlOf', {
                                    ns: 'screens',
                                    total: formatWater(water.totalMl),
                                    target: formatWater(water.targetMl),
                                })}
                            </Text>
                        </VStack>

                        <Pressable
                            style={styles.add}
                            onPress={() => addWater(date, water.glassMl)}
                            disabled={water.isLoading}
                            accessibilityRole="button"
                            accessibilityLabel={t('hydration.addGlassLabel', {
                                ns: 'screens',
                                amount: formatWater(water.glassMl),
                            })}
                        >
                            <Icon name="plus" size={16} color={theme.colors.hydration} />
                            <Text style={styles.addText}>
                                {t('hydration.addGlass', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    </HStack>

                    <ProgressBar
                        value={water.progress}
                        segments={water.targetGlasses}
                        color={theme.colors.hydration}
                        accessibilityLabel={summary}
                    />
                </>
            )}
        </Card>
    );
};
