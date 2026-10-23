import { FC, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { HeaderButton } from '@/components/buttons/header';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { AxisBars, Metric, PeriodPicker } from '@/screens/home/components/charts';
import { HealthPrompt } from '@/screens/home/components/cards';
import {
    ACCENT,
    PERIODS,
    axisFor,
    useMovementSummary,
    useWaterSummary,
    type Period,
} from '@/screens/home/summary';

/**
 * A Today card opened into its charts, after Apple Fitness's Steps screen: the
 * period picker, then one card per figure — its total and its bars, with axes.
 * Water, and distance with steps.
 */

type Kind = 'water' | 'distance';

interface Figure {
    key: string;
    label: string;
    value: string;
    unit?: string;
    color: string;
    data: number[];
}

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    card: {
        padding: theme.space(4),
        gap: theme.space(2),
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
    },
    label: {
        ...theme.typography.eyebrow,
        fontSize: 13,
        textTransform: 'uppercase',
        color: theme.colors.typography,
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        paddingHorizontal: theme.space(1),
    },
}));

const MetricScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const params = useLocalSearchParams<{ kind?: string; period?: string }>();
    const kind: Kind = params.kind === 'distance' ? 'distance' : 'water';
    const [period, setPeriod] = useState<Period>(
        PERIODS.find((p) => p === params.period) ?? 'week',
    );
    const today = useTodayKey();
    const summary = { ...useWaterSummary(period, today), ...useMovementSummary(period, today) };
    const { x, ticks } = axisFor(period, summary.buckets, i18n.language);
    const zeros = summary.buckets.map(() => 0);

    const figures: Figure[] =
        kind === 'water'
            ? [
                  {
                      key: 'water',
                      label: t('metric.total', { ns: 'screens' }),
                      value: summary.water.litres.toFixed(1),
                      unit: 'L',
                      color: ACCENT.water,
                      data: summary.water.series.map((ml) => ml / 1000),
                  },
              ]
            : [
                  {
                      key: 'steps',
                      label: t('metric.steps', { ns: 'screens' }),
                      value: summary.steps ? String(Math.round(summary.steps.total)) : '–',
                      color: ACCENT.steps,
                      data: summary.steps?.series ?? zeros,
                  },
                  {
                      key: 'distance',
                      label: t('metric.distance', { ns: 'screens' }),
                      value: summary.distance ? summary.distance.total.toFixed(2) : '–',
                      unit: summary.distanceUnit,
                      color: ACCENT.distance,
                      data: summary.distance?.series ?? zeros,
                  },
              ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t(`home.dash.${kind}`, { ns: 'screens' })}
                subtitle={t(`metric.this.${period}`, { ns: 'screens' })}
                done={false}
                right={
                    kind === 'water' ? (
                        <HeaderButton
                            icon="plus"
                            onPress={() => router.navigate('/hydration' as never)}
                            accessibilityLabel={t('metric.logWater', { ns: 'screens' })}
                        />
                    ) : undefined
                }
            />

            <PeriodPicker
                labels={PERIODS.map((p) => t(`metric.short.${p}`, { ns: 'screens' }))}
                index={PERIODS.indexOf(period)}
                onChange={(index) => setPeriod(PERIODS[index])}
            />

            {kind === 'distance' && summary.access !== 'granted' ? (
                <VStack style={styles.card}>
                    <HealthPrompt access={summary.access} onConnect={summary.connect} />
                </VStack>
            ) : null}

            {figures.map((figure) => (
                <VStack key={figure.key} style={styles.card}>
                    <Text style={styles.label}>{figure.label}</Text>
                    <Metric
                        value={figure.value}
                        unit={figure.unit}
                        color={figure.color}
                        size={30}
                    />
                    <AxisBars data={figure.data} x={x} ticks={ticks} color={figure.color} />
                </VStack>
            ))}
            {/* HealthKit reads a refusal as no data, so a zero on iOS may be a switch left off. */}
            {kind === 'distance' && Platform.OS === 'ios' && summary.steps?.total === 0 ? (
                <Text style={styles.hint}>{t('health.iosHint', { ns: 'screens' })}</Text>
            ) : null}
        </ScrollView>
    );
};

export default MetricScreen;
