import { FC, useState } from 'react';
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
import { ACCENT, PERIODS, axisFor, useSummary, type Period } from '@/screens/home/summary';

/**
 * A Today card opened into its charts, after Apple Fitness's Steps screen: the
 * period picker, then one card per figure — its total and its bars, with axes.
 * Water, distance (with steps), and sessions (with training time).
 */

type Kind = 'water' | 'distance' | 'sessions';

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
        backgroundColor: theme.colors.elevated,
    },
    label: {
        ...theme.typography.eyebrow,
        fontSize: 13,
        textTransform: 'uppercase',
        color: theme.colors.typography,
    },
}));

const MetricScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const params = useLocalSearchParams<{ kind?: string; period?: string }>();
    const kind: Kind =
        params.kind === 'distance' || params.kind === 'sessions' ? params.kind : 'water';
    const [period, setPeriod] = useState<Period>(
        PERIODS.find((p) => p === params.period) ?? 'week',
    );
    const today = useTodayKey();
    const summary = useSummary(period, today);
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
            : kind === 'distance'
              ? [
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
                ]
              : [
                    {
                        key: 'done',
                        label: t('metric.done', { ns: 'screens' }),
                        value: String(summary.sessions.done),
                        color: ACCENT.sessions,
                        data: summary.sessions.series.done,
                    },
                    {
                        key: 'minutes',
                        label: t('metric.minutes', { ns: 'screens' }),
                        value: String(summary.sessions.series.minutes.reduce((a, b) => a + b, 0)),
                        unit: 'min',
                        color: ACCENT.minutes,
                        data: summary.sessions.series.minutes,
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
        </ScrollView>
    );
};

export default MetricScreen;
