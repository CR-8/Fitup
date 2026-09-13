import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect } from '@/db/schema';
import type { ExerciseHistoryItem } from '@/crud/exercise';
import { HStack } from '@/components/primitives/hstack';
import { formatSet } from '@/helpers/workouts';
import { summariseExerciseHistory } from '@/helpers/exercise-history';
import { WorkoutGroup } from './workout-group';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingTop: theme.space(10),
        paddingBottom: rt.insets.bottom === 0 ? theme.space(10) : rt.insets.bottom,
        gap: theme.space(2),
    },
    emptyTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
    historyContainer: {
        gap: theme.space(5),
    },
    summaryRow: {
        gap: theme.space(3),
    },
    summaryCard: {
        flex: 1,
        gap: theme.space(1),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(4),
    },
    summaryLabel: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    summaryValue: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    summaryMeta: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
}));

interface HistoryProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

export const History: FC<HistoryProps> = ({ history, exercise }) => {
    const { t } = useTranslation(['screens']);
    const summary = useMemo(() => summariseExerciseHistory(exercise, history), [exercise, history]);

    if (history.length === 0) {
        return (
            <VStack style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                    {t('exercise.history.empty.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.emptyDescription}>
                    {t('exercise.history.empty.description', { ns: 'screens' })}
                </Text>
            </VStack>
        );
    }

    return (
        <Box style={styles.container}>
            <VStack style={styles.historyContainer}>
                {summary ? (
                    <HStack style={styles.summaryRow}>
                        <VStack style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>
                                {t('exercise.history.lastPerformed', { ns: 'screens' })}
                            </Text>
                            <Text style={styles.summaryValue} numberOfLines={1}>
                                {summary.lastPerformedAt
                                    ? dayjs(summary.lastPerformedAt).format('D MMM YYYY')
                                    : '—'}
                            </Text>
                            <Text style={styles.summaryMeta}>
                                {t('exercise.history.setCount', {
                                    ns: 'screens',
                                    count: summary.lastSetCount,
                                })}
                            </Text>
                        </VStack>
                        {summary.bestSet ? (
                            <VStack style={styles.summaryCard}>
                                <Text style={styles.summaryLabel}>
                                    {t('exercise.history.best', { ns: 'screens' })}
                                </Text>
                                <Text style={styles.summaryValue} numberOfLines={1}>
                                    {formatSet(exercise, summary.bestSet)}
                                </Text>
                            </VStack>
                        ) : null}
                    </HStack>
                ) : null}
                {history.map((item) => (
                    <WorkoutGroup
                        key={item.workoutExercise.id}
                        workout={item.workout}
                        sets={item.sets}
                        exercise={exercise}
                    />
                ))}
            </VStack>
        </Box>
    );
};
