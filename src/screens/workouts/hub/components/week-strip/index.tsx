import { FC, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import type { WorkoutSelect } from '@/db/schema';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { getTrainingType } from '@/helpers/training-type';
import type { WorkoutOverviewMetaMap } from '@/hooks/use-workouts';

/**
 * This week at a glance, as the reference's plan strip: seven days, the chosen
 * one in a filled circle, today's number in the accent, and a dot under each
 * day for every session, coloured by what kind of training it is. Tapping a day
 * shows just that day below; tapping it again shows everything. Cancelled
 * sessions leave no dot.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        gap: theme.space(1),
    },
    day: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(1.5),
        paddingVertical: theme.space(2),
        borderRadius: theme.radius.xl,
    },
    weekday: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    dateRing: (isSelected: boolean) => ({
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isSelected ? theme.colors.typography : 'transparent',
    }),
    date: (isToday: boolean, isSelected: boolean) => ({
        fontSize: 20,
        lineHeight: 24,
        color: isSelected
            ? theme.colors.background
            : isToday
              ? theme.colors.brand[500]
              : theme.colors.typography,
        ...theme.typography.metric,
    }),
    dots: {
        height: theme.space(2),
        gap: theme.space(0.75),
        alignItems: 'center',
    },
    dot: (color: string, done: boolean) => ({
        height: theme.space(1.5),
        width: theme.space(1.5),
        borderRadius: theme.radius.full,
        backgroundColor: done ? color : 'transparent',
        borderWidth: 1,
        borderColor: color,
    }),
}));

type Props = {
    workouts: WorkoutSelect[];
    overviewMeta: WorkoutOverviewMetaMap;
    firstWeekday: number;
    /** The chosen day's start, as a timestamp; null when no day is chosen. */
    selected: number | null;
    onSelect: (day: number | null) => void;
};

const dayOf = (workout: WorkoutSelect): dayjs.Dayjs | null => {
    const at =
        workout.status === 'completed'
            ? workout.completedAt
            : workout.status === 'cancelled'
              ? null
              : (workout.startAt ?? workout.startedAt);

    return at ? dayjs(at).startOf('day') : null;
};

export const WeekStrip: FC<Props> = ({
    workouts,
    overviewMeta,
    firstWeekday,
    selected,
    onSelect,
}) => {
    const { i18n } = useTranslation();
    const { theme } = useUnistyles();

    const days = useMemo(() => {
        const today = dayjs().startOf('day');
        const offset = firstWeekday === 1 ? today.day() : (today.day() + 6) % 7;
        const start = today.subtract(offset, 'day');

        return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
    }, [firstWeekday]);

    const sessionsByDay = useMemo(() => {
        const map = new Map<number, WorkoutSelect[]>();
        for (const workout of workouts) {
            const day = dayOf(workout);
            if (!day) continue;

            map.set(day.valueOf(), [...(map.get(day.valueOf()) ?? []), workout]);
        }

        return map;
    }, [workouts]);

    return (
        <HStack style={styles.container}>
            {days.map((day) => {
                const isToday = day.isSame(dayjs(), 'day');
                const isSelected = selected === day.valueOf();
                const sessions = (sessionsByDay.get(day.valueOf()) ?? []).slice(0, 3);

                return (
                    <Pressable
                        key={day.valueOf()}
                        style={styles.day}
                        onPress={() => onSelect(isSelected ? null : day.valueOf())}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={day.locale(i18n.language).format('dddd D MMMM')}
                    >
                        <Text style={styles.weekday}>{day.locale(i18n.language).format('dd')}</Text>
                        <Box style={styles.dateRing(isSelected)}>
                            <Text style={styles.date(isToday, isSelected)}>{day.date()}</Text>
                        </Box>
                        <HStack style={styles.dots}>
                            {sessions.map((workout) => (
                                <Box
                                    key={workout.id}
                                    style={styles.dot(
                                        theme.colors.training[
                                            getTrainingType(
                                                overviewMeta[workout.id]?.sortedPrimaryMuscleGroups,
                                            )
                                        ],
                                        workout.status === 'completed',
                                    )}
                                />
                            ))}
                        </HStack>
                    </Pressable>
                );
            })}
        </HStack>
    );
};
