import { FC, useMemo } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { toDateKey } from '@/crud/nutrition';
import { formatWeekProgress, startOfWeekMs } from '@/helpers/workouts';
import { useUser } from '@/hooks/use-user';
import { useWeeklyStreak } from '@/hooks/use-weekly-streak';
import { useWorkouts } from '@/hooks/use-workouts';

import { ACCENT } from '../../summary';

/**
 * This week, day by day, all seven at once: a day with no session is a
 * regeneration day, the rest are numbered training days, struck in the accent
 * with a tick once the session is done. Today's letter is lit. The header
 * carries the weekly streak. A day still to train opens its session; any other
 * opens the day's summary.
 */

const DOT = 38;

const styles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
        padding: theme.space(4),
        gap: theme.space(3),
    },
    header: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    streak: {
        alignItems: 'center',
        gap: theme.space(1),
    },
    streakText: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    days: {
        justifyContent: 'space-between',
    },
    day: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    letter: (isToday: boolean) => ({
        height: 22,
        minWidth: 22,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isToday ? ACCENT.distance : 'transparent',
    }),
    letterText: (isToday: boolean) => ({
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: isToday ? theme.colors.neutral[950] : theme.colors.mutedTypography,
    }),
    dot: (state: 'done' | 'planned' | 'missed' | 'rest') => ({
        height: DOT,
        width: DOT,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: state === 'planned' || state === 'missed' ? 1.5 : 0,
        borderColor: state === 'planned' ? theme.colors.neutral[500] : theme.colors.neutral[700],
        borderStyle: state === 'missed' ? ('dashed' as const) : ('solid' as const),
        backgroundColor:
            state === 'done'
                ? ACCENT.distance
                : state === 'rest'
                  ? theme.colors.neutral[800]
                  : 'transparent',
    }),
    number: (state: 'planned' | 'missed') => ({
        fontSize: 15,
        lineHeight: 20,
        color: state === 'planned' ? theme.colors.typography : theme.colors.mutedTypography,
        ...theme.typography.metric,
    }),
    label: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
}));

export const WeekCard: FC<{ today: string }> = ({ today }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const { data: workouts } = useWorkouts();
    const week = useWeeklyStreak();
    const firstWeekday = user?.firstWeekday || 2;

    const days = useMemo(() => {
        const start = dayjs(startOfWeekMs(firstWeekday, dayjs(today).toDate()));
        const list = (workouts ?? []).filter((workout) => workout.status !== 'cancelled');
        let training = 0;

        return Array.from({ length: 7 }, (_, i) => {
            const day = start.add(i, 'day');
            const key = toDateKey(day.toDate());
            const onDay = list.filter((workout) => {
                const at = workout.status === 'completed' ? workout.completedAt : workout.startAt;
                return !!at && dayjs(at).isSame(day, 'day');
            });
            const done = onDay.some((workout) => workout.status === 'completed');

            return {
                key,
                letter: day.locale(i18n.language).format('dd').charAt(0),
                number: onDay.length > 0 ? ++training : 0,
                state: (onDay.length === 0
                    ? 'rest'
                    : done
                      ? 'done'
                      : key < today
                        ? 'missed'
                        : 'planned') as 'done' | 'planned' | 'missed' | 'rest',
                planned: done ? undefined : onDay[0]?.id,
            };
        });
    }, [firstWeekday, i18n.language, today, workouts]);

    return (
        <VStack style={styles.card}>
            <HStack style={styles.header}>
                <Text style={styles.title} accessibilityRole="header">
                    {t('home.week.title', { ns: 'screens' })}
                </Text>
                <HStack style={styles.streak}>
                    {week.streak > 0 ? (
                        <Icon name="flame" size={14} color={ACCENT.sessions} />
                    ) : null}
                    <Text style={styles.streakText}>
                        {week.streak > 0
                            ? t('home.week.streak', { ns: 'screens', count: week.streak })
                            : formatWeekProgress(week.done, week.target)}
                    </Text>
                </HStack>
            </HStack>

            <HStack style={styles.days}>
                {days.map((day) => {
                    const isToday = day.key === today;
                    const label =
                        day.state === 'rest'
                            ? t('home.week.restShort', { ns: 'screens' })
                            : t('home.week.day', { ns: 'screens', number: day.number });

                    return (
                        <Pressable
                            key={day.key}
                            style={styles.day}
                            onPress={() =>
                                day.planned
                                    ? router.navigate(`/workout/${day.planned}` as never)
                                    : router.navigate({
                                          pathname: '/day',
                                          params: { date: day.key },
                                      } as never)
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`${dayjs(day.key).format('dddd')}, ${
                                day.state === 'rest'
                                    ? t('home.week.rest', { ns: 'screens' })
                                    : label
                            }${day.state === 'done' ? `, ${t('home.week.done', { ns: 'screens' })}` : ''}`}
                            accessibilityState={{ selected: isToday }}
                        >
                            <Box style={styles.letter(isToday)}>
                                <Text style={styles.letterText(isToday)}>{day.letter}</Text>
                            </Box>
                            <Box style={styles.dot(day.state)}>
                                {day.state === 'done' ? (
                                    <Icon
                                        name="check"
                                        size={18}
                                        color={theme.colors.neutral[950]}
                                    />
                                ) : day.state === 'rest' ? (
                                    <Icon
                                        name="refresh"
                                        size={14}
                                        color={theme.colors.mutedTypography}
                                    />
                                ) : (
                                    <Text style={styles.number(day.state)}>{day.number}</Text>
                                )}
                            </Box>
                            <Text style={styles.label} numberOfLines={1}>
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </HStack>
        </VStack>
    );
};
