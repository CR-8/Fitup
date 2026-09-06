import { FC, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { Flame } from 'lucide-react-native';

import { WorkoutSelect } from '@/db/schema';
import { computeStreakDays, getWeekStart } from '@/helpers/workouts';
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

const styles = StyleSheet.create((theme, rt) => ({
    wrapper: {
        paddingHorizontal: theme.space(4),
    },
    container: {
        gap: theme.space(2),
    },
    captionRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.space(1),
    },
    captionLeft: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    // Rides in the row that already labels the strip rather than taking a card
    // of its own — the streak is a fact about the days shown directly beneath
    // it, not a separate statistic.
    streakPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(1),
        paddingHorizontal: theme.space(2),
        paddingVertical: theme.space(0.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
    },
    // `colors.primary` on the light theme's soft coral is 2.8:1 — under the
    // 4.5:1 this 10px label needs. `brand[700]` clears it at 7.3:1 and still
    // reads as the same accent. Dark keeps `primary`: on the tinted ground
    // there it is already 4.7:1.
    streakText: {
        ...theme.fontSize['2xs'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700],
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
    const { theme, rt } = useUnistyles();
    const router = useRouter();

    // Derived here rather than passed down: this component already holds every
    // workout row the calculation needs.
    const streak = useMemo(() => computeStreakDays(workouts), [workouts]);
    const streakColor = rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700];

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
                    <HStack style={styles.captionLeft}>
                        <Text style={styles.caption}>{t('home.thisWeek', { ns: 'screens' })}</Text>
                        {/* Two days is where a run starts being one. Below that
                            the pill would appear and vanish daily, which reads
                            as noise rather than as progress. */}
                        {streak >= 2 ? (
                            <Box
                                style={styles.streakPill}
                                accessibilityRole="text"
                                accessibilityLabel={t('home.streak', {
                                    ns: 'screens',
                                    count: streak,
                                })}
                            >
                                <Flame
                                    size={theme.space(3)}
                                    strokeWidth={2.5}
                                    color={streakColor}
                                    fill={streakColor}
                                />
                                <Text style={styles.streakText}>
                                    {t('home.streak', { ns: 'screens', count: streak })}
                                </Text>
                            </Box>
                        ) : null}
                    </HStack>
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
