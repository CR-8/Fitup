import { FC, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { DayStrip } from '@/components/layout/day-strip';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import type { WorkoutSelect } from '@/db/schema';
import { useStartWorkout } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';
import { ACCENT } from '@/screens/home/summary';

import { moveToToday, useSessionDay, type DayStatus } from '../data';

/**
 * The plan a week at a time, above the history: pick a day to see what was
 * planned and done on it, and train any planned session today. Back sore on
 * back day? Do legs now; back takes legs' day.
 */

const STATUS_COLOR: Record<DayStatus, string> = {
    completed: ACCENT.distance,
    in_progress: ACCENT.sessions,
    planned: ACCENT.water,
    missed: '#FF453A',
};

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(3),
        // Above iOS's native list rather than inside it, so it pads itself.
        ...(Platform.OS === 'ios' && {
            paddingHorizontal: theme.space(4),
            paddingVertical: theme.space(2),
        }),
    },
    figures: {
        gap: theme.space(2),
    },
    figure: {
        flex: 1,
        gap: theme.space(0.5),
        padding: theme.space(3),
        borderRadius: theme.radius.xl,
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
    },
    figureLabel: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    figureValue: {
        fontSize: 22,
        lineHeight: 28,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        padding: theme.space(3),
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
    },
    rowText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    name: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    status: (color: string) => ({
        ...theme.fontSize.sm,
        color,
    }),
    action: {
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius.full,
        backgroundColor: ACCENT.distance,
    },
    actionText: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.neutral[950],
    },
    empty: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

export const SessionWeek: FC = () => {
    const { t } = useTranslation(['screens']);
    const { user } = useUser();
    const today = dayjs().format('YYYY-MM-DD');
    const [date, setDate] = useState(today);
    const day = useSessionDay(date, user?.firstWeekday || 2);
    const { mutateAsync: startWorkout, isPending } = useStartWorkout();

    const train = async (workout: WorkoutSelect) => {
        if (day.running) {
            router.navigate('/timer');
            return;
        }

        try {
            await moveToToday(workout, day.workouts);
            await startWorkout({ workoutId: workout.id, source: 'planned' });
            setDate(today);
            router.navigate('/timer');
        } catch (error) {
            reportError(error, 'Failed to start a workout from Sessions');
            Alert.alert(t('sessions.plan.startFailed', { ns: 'screens' }));
        }
    };

    const actionFor = (workout: WorkoutSelect, status: DayStatus) => {
        if (status === 'in_progress') {
            return {
                label: t('sessions.plan.resume', { ns: 'screens' }),
                onPress: () => router.navigate('/timer'),
            };
        }
        if (status === 'completed') return null;

        return {
            label: t(
                dayjs(workout.startAt).isSame(dayjs(), 'day')
                    ? 'sessions.plan.start'
                    : 'sessions.plan.doToday',
                { ns: 'screens' },
            ),
            onPress: () => void train(workout),
        };
    };

    const figures = [
        { key: 'weekDone', value: day.weekDone },
        { key: 'weekTime', value: day.weekTime },
        { key: 'dayTime', value: day.dayTime },
    ];

    return (
        <VStack style={styles.container}>
            <DayStrip selected={date} onSelect={setDate} firstWeekday={user?.firstWeekday || 2} />

            <HStack style={styles.figures}>
                {figures.map((figure) => (
                    <VStack key={figure.key} style={styles.figure}>
                        <Text style={styles.figureLabel} numberOfLines={1}>
                            {t(`sessions.plan.${figure.key}`, { ns: 'screens' })}
                        </Text>
                        <Text style={styles.figureValue}>{figure.value}</Text>
                    </VStack>
                ))}
            </HStack>

            {day.sessions.length === 0 ? (
                <Text style={styles.empty}>{t('sessions.plan.empty', { ns: 'screens' })}</Text>
            ) : (
                day.sessions.map(({ workout, status }) => {
                    const action = actionFor(workout, status);

                    return (
                        <Pressable
                            key={workout.id}
                            onPress={() =>
                                router.navigate(
                                    (status === 'completed'
                                        ? `/session/${workout.id}`
                                        : `/workout/${workout.id}`) as never,
                                )
                            }
                            accessibilityRole="button"
                        >
                            <HStack style={styles.row}>
                                <VStack style={styles.rowText}>
                                    <Text style={styles.name} numberOfLines={1}>
                                        {workout.name}
                                    </Text>
                                    <Text style={styles.status(STATUS_COLOR[status])}>
                                        {t(`sessions.plan.status.${status}`, { ns: 'screens' })}
                                    </Text>
                                </VStack>
                                {action ? (
                                    <Pressable
                                        style={styles.action}
                                        onPress={action.onPress}
                                        disabled={isPending}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.actionText}>{action.label}</Text>
                                    </Pressable>
                                ) : null}
                            </HStack>
                        </Pressable>
                    );
                })
            )}
        </VStack>
    );
};
