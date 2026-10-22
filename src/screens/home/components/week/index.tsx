import { FC, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { toDateKey } from '@/crud/nutrition';
import { startOfWeekMs } from '@/helpers/workouts';
import { useUser } from '@/hooks/use-user';
import { useWorkouts } from '@/hooks/use-workouts';

import { ACCENT } from '../../summary';

/**
 * This week, day by day: a day with no session is a regeneration day ("R"),
 * the rest are numbered training days, their sprout green once the session is
 * done. Today is outlined; a day opens its summary.
 */

const styles = StyleSheet.create((theme) => ({
    card: {
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
        paddingVertical: theme.space(3),
    },
    days: {
        gap: theme.space(2),
        paddingHorizontal: theme.space(3),
    },
    day: (isToday: boolean) => ({
        minWidth: 56,
        alignItems: 'center',
        gap: theme.space(1),
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(2.5),
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous' as const,
        borderWidth: isToday ? 1.5 : 1,
        borderColor: isToday ? ACCENT.water : theme.colors.neutral[700],
        backgroundColor: isToday ? `${ACCENT.water}14` : theme.colors.neutral[900],
    }),
    mark: {
        fontSize: 20,
        lineHeight: 26,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    label: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
}));

export const WeekCard: FC<{ today: string }> = ({ today }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const { data: workouts } = useWorkouts();
    const scroll = useRef<ScrollView>(null);
    const firstWeekday = user?.firstWeekday || 2;

    const days = useMemo(() => {
        const start = dayjs(startOfWeekMs(firstWeekday, dayjs(today).toDate()));
        const list = (workouts ?? []).filter((workout) => workout.status !== 'cancelled');
        let training = 0;

        return Array.from({ length: 7 }, (_, i) => {
            const day = start.add(i, 'day');
            const onDay = list.filter((workout) => {
                const at = workout.status === 'completed' ? workout.completedAt : workout.startAt;
                return !!at && dayjs(at).isSame(day, 'day');
            });
            const isTraining = onDay.length > 0;

            return {
                key: toDateKey(day.toDate()),
                number: isTraining ? ++training : 0,
                done: onDay.some((workout) => workout.status === 'completed'),
            };
        });
    }, [firstWeekday, today, workouts]);

    return (
        <Box style={styles.card}>
            <ScrollView
                ref={scroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.days}
            >
                {days.map((day) => {
                    const isToday = day.key === today;
                    const rest = day.number === 0;
                    const label = rest
                        ? t('home.week.rest', { ns: 'screens' })
                        : t('home.week.day', { ns: 'screens', number: day.number });

                    return (
                        <Pressable
                            key={day.key}
                            style={styles.day(isToday)}
                            onPress={() =>
                                router.navigate({
                                    pathname: '/day',
                                    params: { date: day.key },
                                } as never)
                            }
                            // Today in view, however late in the week it falls.
                            onLayout={
                                isToday
                                    ? (event) =>
                                          scroll.current?.scrollTo({
                                              x: Math.max(0, event.nativeEvent.layout.x - 48),
                                              animated: false,
                                          })
                                    : undefined
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`${dayjs(day.key).format('dddd')}, ${label}${
                                day.done ? `, ${t('home.week.done', { ns: 'screens' })}` : ''
                            }`}
                            accessibilityState={{ selected: isToday }}
                        >
                            <Icon
                                name={rest ? 'refresh' : 'sprout'}
                                size={22}
                                color={
                                    rest
                                        ? isToday
                                            ? ACCENT.water
                                            : theme.colors.mutedTypography
                                        : day.done
                                          ? theme.colors.success
                                          : theme.colors.neutral[600]
                                }
                            />
                            <Text style={styles.mark}>
                                {rest ? t('home.week.restMark', { ns: 'screens' }) : day.number}
                            </Text>
                            <Text style={styles.label} numberOfLines={1}>
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </Box>
    );
};
