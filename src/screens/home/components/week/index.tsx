import { FC, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';

import { WorkoutSelect } from '@/db/schema';
import { getWeekStart } from '@/helpers/workouts';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';

interface WeekStatsProps {
    workouts: WorkoutSelect[];
    firstWeekday: number;
    /** Completed this week, so the strip can say what it is showing. */
    sessions: number;
    /** The target from onboarding, or null when it was never answered. */
    sessionsGoal: number | null;
}

const styles = StyleSheet.create((theme) => ({
    wrapper: {
        paddingHorizontal: theme.space(4),
    },
    container: {
        gap: theme.space(2),
    },
    captionRow: {
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: theme.space(1),
    },
    caption: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    captionValue: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    weekdaysRow: {
        justifyContent: 'space-between',
    },
    weekdayCell: {
        width: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
    weekdayLabel: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.45,
        textTransform: 'capitalize',
    },
    weekdayLabelToday: {
        opacity: 1,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    daysRow: {
        justifyContent: 'space-between',
    },
    dayCell: {
        width: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircle: {
        height: theme.space(11),
        width: theme.space(11),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderWidth: theme.space(0.25),
        borderColor: theme.colors.border,
    },
    dayCircleCompleted: {
        backgroundColor: theme.colors.brand[400],
        borderColor: theme.colors.brand[400],
    },
    dayCircleToday: {
        borderColor: theme.colors.typography,
    },
    dayText: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.medium.fontWeight,
        opacity: 0.6,
    },
    dayTextCompleted: {
        color: theme.colors.neutral[950],
        opacity: 1,
    },
    dayTextToday: {
        opacity: 1,
    },
}));

export const WeekStats: FC<WeekStatsProps> = ({
    workouts,
    firstWeekday,
    sessions,
    sessionsGoal,
}) => {
    const { t, i18n } = useTranslation(['screens']);
    const router = useRouter();

    const workoutDayKeys = useMemo(() => {
        const keys = new Set<string>();
        workouts.forEach((workout) => {
            if (workout.status !== 'completed') return;
            const workoutDate = workout.completedAt ?? workout.startedAt ?? workout.createdAt;
            if (!workoutDate) return;
            const date = dayjs(workoutDate);
            if (!date.isValid()) return;
            keys.add(date.format('YYYY-MM-DD'));
        });
        return keys;
    }, [workouts]);

    const weekDays = useMemo(() => {
        const today = dayjs();
        // Shared with `groupWorkoutsByWeek`, which decides how the completed
        // sections below are bucketed. A second copy of this arithmetic meant
        // the strip and the list could disagree about when the week starts.
        const weekStart = dayjs(getWeekStart(today.toDate(), firstWeekday)).startOf('day');
        const weekdayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
        const todayKey = today.format('YYYY-MM-DD');

        return Array.from({ length: 7 }, (_, index) => {
            const date = weekStart.add(index, 'day');
            const dateKey = date.format('YYYY-MM-DD');
            const weekday = weekdayFormatter.format(date.toDate());

            return {
                dateKey,
                day: date.date(),
                weekday,
                isToday: dateKey === todayKey,
                isWorkoutDay: workoutDayKeys.has(dateKey),
            };
        });
    }, [firstWeekday, i18n.language, workoutDayKeys]);

    const handleDayPress = useCallback(
        (dateKey: string) => {
            router.navigate({
                pathname: '/day',
                params: { date: dateKey },
            } as any);
        },
        [router],
    );

    return (
        <Box style={styles.wrapper}>
            <VStack style={styles.container}>
                <HStack style={styles.captionRow}>
                    <Text style={styles.caption}>{t('home.thisWeek', { ns: 'screens' })}</Text>
                    <Text style={styles.captionValue}>
                        {typeof sessionsGoal === 'number' && sessionsGoal > 0
                            ? t('home.sessionsOfGoal', {
                                  ns: 'screens',
                                  count: sessions,
                                  goal: sessionsGoal,
                              })
                            : t('home.sessionsDone', { ns: 'screens', count: sessions })}
                    </Text>
                </HStack>
                <HStack style={styles.weekdaysRow}>
                    {weekDays.map((item) => (
                        <Box key={`weekday-${item.dateKey}`} style={styles.weekdayCell}>
                            <Text
                                style={[
                                    styles.weekdayLabel,
                                    item.isToday && styles.weekdayLabelToday,
                                ]}
                            >
                                {item.weekday}
                            </Text>
                        </Box>
                    ))}
                </HStack>
                <HStack style={styles.daysRow}>
                    {weekDays.map((item) => (
                        <Box key={item.dateKey} style={styles.dayCell}>
                            <Pressable
                                onPress={() => handleDayPress(item.dateKey)}
                                disabled={!item.isWorkoutDay}
                            >
                                <Box
                                    style={[
                                        styles.dayCircle,
                                        item.isWorkoutDay && styles.dayCircleCompleted,
                                        item.isToday && styles.dayCircleToday,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.dayText,
                                            item.isWorkoutDay && styles.dayTextCompleted,
                                            item.isToday && styles.dayTextToday,
                                        ]}
                                    >
                                        {item.day}
                                    </Text>
                                </Box>
                            </Pressable>
                        </Box>
                    ))}
                </HStack>
            </VStack>
        </Box>
    );
};
