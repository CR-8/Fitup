import { FC, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { AxisBars, Metric, PeriodPicker } from '@/screens/home/components/charts';
import { HealthPrompt } from '@/screens/home/components/cards';
import { ACCENT, PERIODS, axisFor, useMovementSummary, type Period } from '@/screens/home/summary';

/**
 * A Today card opened into its charts, after Apple Fitness's Steps screen: the
 * period picker, then one card per figure — its total and its bars, with axes.
 * Steps and distance, titled by the card that opened it. Water has its own
 * screen, its log and its chart together (`screens/hydration`).
 */

type Kind = 'steps' | 'distance';

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
    const kind: Kind = params.kind === 'distance' ? 'distance' : 'steps';
    const [period, setPeriod] = useState<Period>(
        PERIODS.find((p) => p === params.period) ?? 'week',
    );
    const today = useTodayKey();
    const summary = useMovementSummary(period, today);
    const { x, ticks } = axisFor(period, summary.buckets, i18n.language);
    const zeros = summary.buckets.map(() => 0);

    const figures: Figure[] = [
        {
            key: 'steps',
            label: t('metric.steps', { ns: 'screens' }),
            value: summary.steps
                ? Math.round(summary.steps.total).toLocaleString(i18n.language)
                : '–',
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
                title={t(`metric.${kind}`, { ns: 'screens' })}
                subtitle={t(`metric.this.${period}`, { ns: 'screens' })}
                done={false}
            />

            <PeriodPicker
                labels={PERIODS.map((p) => t(`metric.short.${p}`, { ns: 'screens' }))}
                index={PERIODS.indexOf(period)}
                onChange={(index) => setPeriod(PERIODS[index])}
            />

            {summary.access !== 'granted' ? (
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
            {Platform.OS === 'ios' && summary.steps?.total === 0 ? (
                <Text style={styles.hint}>{t('health.iosHint', { ns: 'screens' })}</Text>
            ) : null}
        </ScrollView>
    );
};

export default MetricScreen;
