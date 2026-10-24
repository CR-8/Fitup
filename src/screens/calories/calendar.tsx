import { FC, ReactNode, useRef } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';

import { toDateKey } from '@/crud/nutrition';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { useCaloriesStore } from '@/stores/calories';
import { Ring } from '@/screens/home/components/charts';
import { ACCENT, useCalorieDays } from '@/screens/home/summary';

import { weekStart } from '.';

/**
 * Every day's ring, a month at a time, Monday first; picking a day shows it on
 * the ring screen. Opens scrolled to this month. Shared by the calorie ring
 * and the activity rings (`screens/activity/calendar`).
 */

// ponytail: three months, one ring each (a SwiftUI host on iOS); page further back if asked.
const MONTHS = 3;

/** The months the calendar shows, oldest first, ending with `today`'s. */
export const calendarMonths = (today: string): Dayjs[] =>
    Array.from({ length: MONTHS }, (_, i) =>
        dayjs(today)
            .startOf('month')
            .subtract(MONTHS - 1 - i, 'month'),
    );

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    month: {
        gap: theme.space(2),
    },
    monthTitle: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: theme.space(3),
    },
    cell: {
        width: `${100 / 7}%`,
        alignItems: 'center',
        gap: theme.space(1),
    },
    weekday: {
        width: `${100 / 7}%`,
        textAlign: 'center',
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    number: (selected: boolean, color: string) => ({
        height: 26,
        minWidth: 26,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? color : 'transparent',
    }),
    numberText: (selected: boolean, isToday: boolean, color: string) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? theme.colors.neutral[950] : isToday ? color : theme.colors.typography,
    }),
}));

export const RingCalendar: FC<{
    title: string;
    months: Dayjs[];
    selected: string;
    /** The selected day's fill and today's number. */
    color: string;
    onPick: (date: string) => void;
    ring: (date: string) => ReactNode;
}> = ({ title, months, selected, color, onPick, ring }) => {
    const { i18n } = useTranslation();
    const scroll = useRef<ScrollView>(null);
    const today = useTodayKey();
    const monday = weekStart(today);

    return (
        <ScrollView
            ref={scroll}
            style={styles.container}
            contentContainerStyle={modalStyles.content}
            contentInsetAdjustmentBehavior="automatic"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
            <ModalHeader title={title} />

            <HStack>
                {Array.from({ length: 7 }, (_, i) => (
                    <Text key={i} style={styles.weekday}>
                        {monday.add(i, 'day').locale(i18n.language).format('dd').charAt(0)}
                    </Text>
                ))}
            </HStack>

            {months.map((month) => {
                const blanks = (month.day() + 6) % 7;

                return (
                    <VStack key={month.format('YYYY-MM')} style={styles.month}>
                        <Text style={styles.monthTitle}>
                            {month.locale(i18n.language).format('MMMM YYYY')}
                        </Text>
                        <Box style={styles.grid}>
                            {Array.from({ length: blanks }, (_, i) => (
                                <Box key={`blank-${i}`} style={styles.cell} />
                            ))}
                            {Array.from({ length: month.daysInMonth() }, (_, i) => {
                                const date = toDateKey(month.add(i, 'day').toDate());
                                const isSelected = date === selected;

                                return (
                                    <Pressable
                                        key={date}
                                        style={styles.cell}
                                        onPress={() => {
                                            onPick(date);
                                            router.back();
                                        }}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={dayjs(date)
                                            .locale(i18n.language)
                                            .format('dddd, MMMM D')}
                                    >
                                        <Box style={styles.number(isSelected, color)}>
                                            <Text
                                                style={styles.numberText(
                                                    isSelected,
                                                    date === today,
                                                    color,
                                                )}
                                            >
                                                {i + 1}
                                            </Text>
                                        </Box>
                                        {ring(date)}
                                    </Pressable>
                                );
                            })}
                        </Box>
                    </VStack>
                );
            })}
        </ScrollView>
    );
};

const CalendarScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const today = useTodayKey();
    const day = useCaloriesStore((state) => state.day) || today;
    const setDay = useCaloriesStore((state) => state.setDay);
    const months = calendarMonths(today);
    const { goalFor, consumedOn } = useCalorieDays(
        toDateKey(months[0].toDate()),
        toDateKey(months[months.length - 1].endOf('month').toDate()),
    );

    return (
        <RingCalendar
            title={t('calories.calendar', { ns: 'screens' })}
            months={months}
            selected={day}
            color={ACCENT.calories}
            onPick={setDay}
            ring={(date) => (
                <Ring
                    progress={goalFor(date) > 0 ? consumedOn(date) / goalFor(date) : 0}
                    color={ACCENT.calories}
                    size={34}
                />
            )}
        />
    );
};

export default CalendarScreen;
