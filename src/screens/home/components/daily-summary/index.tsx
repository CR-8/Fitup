import { FC } from 'react';
import type { ColorValue } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle } from '@/components/layout/card';
import { ProgressBar } from '@/components/feedback/progress-bar';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { useMealsForDate } from '@/hooks/use-nutrition';
import { formatGlasses, useWaterDay } from '@/hooks/use-water';

/**
 * "Today so far": training, water and meals, each against what today asked
 * for. Three labelled bars, not rings: each counts something different, and
 * every number is a count of things the person actually did.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
    },
    rows: {
        gap: theme.space(3.5),
    },
    row: {
        gap: theme.space(1.5),
    },
    labelRow: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    label: {
        ...theme.fontSize.sm,
        flex: 1,
        color: theme.colors.mutedTypography,
    },
    value: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
}));

interface SummaryRow {
    key: string;
    icon: IconName;
    color: ColorValue;
    label: string;
    value: string;
    progress: number;
}

const Row: FC<SummaryRow> = ({ icon, color, label, value, progress }) => (
    <VStack style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
        <HStack style={styles.labelRow}>
            <Icon name={icon} size={16} color={color} />
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </HStack>
        <ProgressBar value={progress} color={color} height={6} accessibilityLabel={label} />
    </VStack>
);

interface DailySummaryProps {
    date: string;
    /** Sessions finished today, and today's sessions in all (finished, running or planned). */
    training: { done: number; total: number } | null;
}

export const DailySummary: FC<DailySummaryProps> = ({ date, training }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const water = useWaterDay(date);
    const { meals } = useMealsForDate(date);

    const planned = meals.filter((entry) => entry.items.length > 0);
    const eaten = planned.filter((entry) =>
        entry.items.every((item) => item.consumedAt != null),
    ).length;

    const rows: SummaryRow[] = [
        {
            key: 'training',
            icon: 'dumbbell',
            color: theme.colors.primary,
            label: t('home.summary.training', { ns: 'screens' }),
            value: !training
                ? '–'
                : training.total === 0
                  ? t('home.summary.nothingPlanned', { ns: 'screens' })
                  : t('home.summary.sessions', {
                        ns: 'screens',
                        done: training.done,
                        count: training.total,
                    }),
            progress: training && training.total > 0 ? training.done / training.total : 0,
        },
        {
            key: 'water',
            icon: 'droplet',
            color: theme.colors.hydration,
            label: t('hydration.title', { ns: 'screens' }),
            value: water.isLoading
                ? '–'
                : t('hydration.glassesOf', {
                      ns: 'screens',
                      glasses: formatGlasses(water.glasses),
                      target: water.targetGlasses,
                  }),
            progress: water.progress,
        },
        {
            key: 'meals',
            icon: 'utensils',
            color: theme.colors.amber[400],
            label: t('home.summary.meals', { ns: 'screens' }),
            value:
                planned.length === 0
                    ? t('home.summary.noMeals', { ns: 'screens' })
                    : t('home.summary.mealsEaten', {
                          ns: 'screens',
                          done: eaten,
                          count: planned.length,
                      }),
            progress: planned.length > 0 ? eaten / planned.length : 0,
        },
    ];

    return (
        <Card
            style={styles.container}
            onPress={() => router.navigate({ pathname: '/day', params: { date } })}
            accessibilityHint={t('home.summary.openHint', { ns: 'screens' })}
        >
            <CardTitle title={t('home.summary.title', { ns: 'screens' })} chevron />
            <VStack style={styles.rows}>
                {rows.map(({ key, ...row }) => (
                    <Row key={key} {...row} />
                ))}
            </VStack>
        </Card>
    );
};
