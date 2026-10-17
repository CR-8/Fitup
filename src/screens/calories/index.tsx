import { FC, useMemo } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { sumConsumed, toDateKey } from '@/crud/nutrition';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { HeaderButton } from '@/components/buttons/header';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { useCaloriesStore } from '@/stores/calories';
import { Bars, Metric, Ring } from '@/screens/home/components/charts';
import { ACCENT, useCalorieDays } from '@/screens/home/summary';

import { GoalMenu } from './components/goal-menu';

/**
 * The calorie ring opened from Today, after Apple Fitness's ring detail: the
 * week's rings, the day's ring, eaten against the goal by the hour, the day's
 * macros, and the goal itself (for this day only, or every day).
 */

/** Where the hour axis is labelled, as Apple's is: midnight, 6, noon, 6. */
const AXIS_HOURS = [0, 6, 12, 18];

/** Monday of `date`'s week. */
export const weekStart = (date: string) => {
    const day = dayjs(date);

    return day.subtract((day.day() + 6) % 7, 'day');
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    week: {
        justifyContent: 'space-between',
    },
    weekday: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    letter: (selected: boolean) => ({
        height: 24,
        width: 24,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? ACCENT.calories : 'transparent',
    }),
    letterText: (selected: boolean) => ({
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? theme.colors.neutral[950] : theme.colors.mutedTypography,
    }),
    todayDot: (visible: boolean) => ({
        height: 5,
        width: 5,
        marginTop: -4,
        borderRadius: theme.radius.full,
        backgroundColor: visible ? ACCENT.calories : 'transparent',
    }),
    bigRing: {
        alignItems: 'center',
        paddingVertical: theme.space(4),
    },
    titleRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 19,
        lineHeight: 24,
        color: theme.colors.typography,
    },
    axis: {
        marginTop: -theme.space(2),
    },
    axisLabel: {
        flex: 1,
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    total: {
        ...theme.typography.eyebrow,
        marginTop: -theme.space(3),
        textTransform: 'uppercase',
        color: ACCENT.calories,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    macros: {
        justifyContent: 'space-between',
    },
    buttons: {
        gap: theme.space(3),
    },
    button: {
        flex: 1,
    },
}));

const CaloriesScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const today = useTodayKey();
    const day = useCaloriesStore((state) => state.day) || today;
    const setDay = useCaloriesStore((state) => state.setDay);

    const monday = weekStart(day);
    const week = Array.from({ length: 7 }, (_, i) => toDateKey(monday.add(i, 'day').toDate()));
    const calorieDays = useCalorieDays(week[0], week[6]);
    const { goalFor, consumedOn, byDate } = calorieDays;

    const goal = goalFor(day);
    const consumed = consumedOn(day);
    const isToday = day === today;

    const { hourly, macros } = useMemo(() => {
        const meals = byDate[day] ?? [];
        const series = Array.from({ length: 24 }, () => 0);
        meals
            .flatMap((entry) => entry.items)
            .forEach((item) => {
                if (item.consumedAt) series[dayjs(item.consumedAt).hour()] += item.calories ?? 0;
            });

        return { hourly: series, macros: sumConsumed(meals) };
    }, [byDate, day]);

    const date = dayjs(day).locale(i18n.language);
    const title = isToday
        ? t('calories.today', { ns: 'screens', date: date.format('MMM D, YYYY') })
        : date.format('ddd, MMM D, YYYY');

    const openGoal = (mode: 'today' | 'daily') =>
        router.navigate({ pathname: '/calorie-goal', params: { mode } } as never);

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={title}
                done={false}
                right={
                    <HeaderButton
                        icon="calendar"
                        onPress={() => router.navigate('/calendar' as never)}
                        accessibilityLabel={t('calories.openCalendar', { ns: 'screens' })}
                    />
                }
            />

            <HStack style={styles.week}>
                {week.map((date) => {
                    const selected = date === day;

                    return (
                        <Pressable
                            key={date}
                            style={styles.weekday}
                            onPress={() => setDay(date)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={dayjs(date).locale(i18n.language).format('dddd')}
                        >
                            <Box style={styles.letter(selected)}>
                                <Text style={styles.letterText(selected)}>
                                    {dayjs(date).locale(i18n.language).format('dd').charAt(0)}
                                </Text>
                            </Box>
                            <Box style={styles.todayDot(date === today)} />
                            <Ring
                                progress={goalFor(date) > 0 ? consumedOn(date) / goalFor(date) : 0}
                                color={ACCENT.calories}
                                size={38}
                            />
                        </Pressable>
                    );
                })}
            </HStack>

            <Box style={styles.bigRing}>
                <Ring
                    progress={goal > 0 ? consumed / goal : 0}
                    color={ACCENT.calories}
                    size={240}
                />
            </Box>

            <HStack style={styles.titleRow}>
                <VStack>
                    <Text style={styles.label}>{t('calories.consumed', { ns: 'screens' })}</Text>
                    <Metric value={`${consumed}/${goal}`} unit="kcal" color={ACCENT.calories} />
                </VStack>
                <GoalMenu
                    color={ACCENT.calories}
                    labels={{
                        button: t('calories.goalMenu', { ns: 'screens' }),
                        today: t('calories.adjustToday', { ns: 'screens' }),
                        daily: t('calories.changeDaily', { ns: 'screens' }),
                    }}
                    onAdjustToday={() => openGoal('today')}
                    onChangeDaily={() => openGoal('daily')}
                />
            </HStack>

            <Bars data={hourly} current={isToday ? dayjs().hour() : -1} color={ACCENT.calories} />
            <HStack style={styles.axis}>
                {AXIS_HOURS.map((hour) => (
                    <Text key={hour} style={styles.axisLabel}>
                        {dayjs().startOf('day').add(hour, 'hour').format('h A')}
                    </Text>
                ))}
            </HStack>
            <Text style={styles.total}>
                {t('calories.total', { ns: 'screens', total: consumed })}
            </Text>

            <Box style={styles.divider} />

            <HStack style={styles.macros}>
                {(
                    [
                        ['protein', macros.proteinG],
                        ['carbs', macros.carbsG],
                        ['fat', macros.fatG],
                    ] as const
                ).map(([key, grams]) => (
                    <VStack key={key}>
                        <Text style={styles.label}>{t(`calories.${key}`, { ns: 'screens' })}</Text>
                        <Metric
                            value={String(Math.round(grams))}
                            unit="g"
                            color={theme.colors.neutral[50]}
                            size={28}
                        />
                    </VStack>
                ))}
            </HStack>

            <HStack style={styles.buttons}>
                <Button
                    title={t('calories.changeGoal', { ns: 'screens' })}
                    containerStyle={styles.button}
                    onPress={() => openGoal('daily')}
                />
                <Button
                    title={t('calories.logMeal', { ns: 'screens' })}
                    containerStyle={styles.button}
                    onPress={() => router.navigate('/diet' as never)}
                />
            </HStack>
        </ScrollView>
    );
};

export default CaloriesScreen;
