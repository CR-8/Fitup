import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { useWorkoutStats } from '@/hooks/use-workouts';
import { useLatestMeasurementsByMetric } from '@/hooks/use-measurements';
import { useUser } from '@/hooks/use-user';
import { convertWeight } from '@/helpers/units';

/**
 * Three figures under the up-next card: what has been lifted, how long this week
 * took, and what the user weighs.
 *
 * Each comes from something that already exists — `useWorkoutStats` for volume
 * (already converted into the user's unit), the week summary Home computes for
 * its strip, and the latest `body_weight` measurement. Nothing is recomputed
 * here and nothing new is persisted.
 *
 * A figure with no data is rendered as an em dash rather than a zero. "0 kg
 * lifted" is a claim about a user who has trained and lifted nothing; a dash
 * says the app has not been told yet, which on a fresh account is the truth.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    cell: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(0.5),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: theme.space(3.5),
        paddingHorizontal: theme.space(2),
    },
    value: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    label: {
        ...theme.fontSize['2xs'],
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
}));

const EMPTY = '—';

/** 1,940 reads as 1.9k; below a thousand the exact number is more use. */
const compact = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(Math.round(value));

const duration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;

    return `${hours}h ${minutes}m`;
};

interface StatsRowProps {
    /** From `summariseWeek`, which Home already computes for the week strip. */
    weekDurationSeconds: number;
}

export const StatsRow: FC<StatsRowProps> = ({ weekDurationSeconds }) => {
    const { t } = useTranslation(['screens']);
    const { user } = useUser();
    const stats = useWorkoutStats();
    const latest = useLatestMeasurementsByMetric(useMemo(() => ['body_weight'], []));

    const weightUnit = user?.bodyWeightUnits ?? 'kg';

    // Measurements are stored in kilograms regardless of what the user reads
    // them in, so the conversion belongs here and not in the row.
    const bodyWeight = useMemo(() => {
        const value = latest.body_weight?.value;

        if (typeof value !== 'number') return null;

        return weightUnit === 'lb' ? convertWeight(value, 'kg', 'lb') : value;
    }, [latest.body_weight?.value, weightUnit]);

    const cells = [
        {
            key: 'volume',
            value: stats.volume ? compact(stats.volume) : EMPTY,
            label: t(`home.stats.volume_${user?.weightUnits ?? 'kg'}`, { ns: 'screens' }),
        },
        {
            key: 'week',
            value: weekDurationSeconds > 0 ? duration(weekDurationSeconds) : EMPTY,
            label: t('home.thisWeek', { ns: 'screens' }),
        },
        {
            key: 'weight',
            value: bodyWeight === null ? EMPTY : String(Math.round(bodyWeight * 10) / 10),
            label: t(`common:weightUnit.${weightUnit}`),
        },
    ];

    return (
        <HStack style={styles.container}>
            {cells.map((cell) => (
                <VStack key={cell.key} style={styles.cell}>
                    <Text style={styles.value}>{cell.value}</Text>
                    <Text style={styles.label}>{cell.label}</Text>
                </VStack>
            ))}
        </HStack>
    );
};
