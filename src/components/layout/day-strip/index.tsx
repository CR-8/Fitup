import { FC, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';

/**
 * A week of days, as the reference's plan strip: weekday letters over dates,
 * the chosen day in a filled circle, today's date in the accent, and arrows
 * either side to move a week. Dates are local `YYYY-MM-DD` keys.
 */

const styles = StyleSheet.create((theme) => ({
    row: {
        alignItems: 'center',
        gap: theme.space(1),
    },
    arrow: {
        height: 44,
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    days: {
        flex: 1,
        justifyContent: 'space-between',
    },
    day: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(1.5),
        paddingVertical: theme.space(1),
    },
    weekday: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    circle: (selected: boolean) => ({
        height: theme.space(9),
        width: theme.space(9),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: selected ? theme.colors.typography : 'transparent',
    }),
    date: (selected: boolean, today: boolean) => ({
        fontSize: 20,
        lineHeight: 24,
        color: selected
            ? theme.colors.background
            : today
              ? theme.colors.brand[500]
              : theme.colors.typography,
        ...theme.typography.metric,
    }),
}));

interface DayStripProps {
    selected: string;
    onSelect: (date: string) => void;
    /** 1 = Sunday first, 2 = Monday first, as `user.firstWeekday`. */
    firstWeekday?: number;
}

export const DayStrip: FC<DayStripProps> = ({ selected, onSelect, firstWeekday = 2 }) => {
    const { t, i18n } = useTranslation(['common']);
    const { theme } = useUnistyles();

    const days = useMemo(() => {
        const anchor = dayjs(selected);
        const offset = firstWeekday === 1 ? anchor.day() : (anchor.day() + 6) % 7;
        const start = anchor.subtract(offset, 'day');

        return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
    }, [firstWeekday, selected]);

    const move = (weeks: number) =>
        onSelect(dayjs(selected).add(weeks, 'week').format('YYYY-MM-DD'));

    return (
        <HStack style={styles.row}>
            <Pressable
                style={styles.arrow}
                onPress={() => move(-1)}
                accessibilityRole="button"
                accessibilityLabel={t('previousWeek', {
                    ns: 'common',
                    defaultValue: 'Previous week',
                })}
            >
                <Icon name="chevron-left" size={18} color={theme.colors.mutedTypography} />
            </Pressable>

            <HStack style={styles.days}>
                {days.map((day) => {
                    const key = day.format('YYYY-MM-DD');
                    const isSelected = key === selected;
                    const isToday = day.isSame(dayjs(), 'day');

                    return (
                        <Pressable
                            key={key}
                            style={styles.day}
                            onPress={() => onSelect(key)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={day.locale(i18n.language).format('dddd D MMMM')}
                        >
                            <Text style={styles.weekday}>
                                {day.locale(i18n.language).format('dd')}
                            </Text>
                            <Box style={styles.circle(isSelected)}>
                                <Text style={styles.date(isSelected, isToday)}>{day.date()}</Text>
                            </Box>
                        </Pressable>
                    );
                })}
            </HStack>

            <Pressable
                style={styles.arrow}
                onPress={() => move(1)}
                accessibilityRole="button"
                accessibilityLabel={t('nextWeek', { ns: 'common', defaultValue: 'Next week' })}
            >
                <Icon name="chevron-right" size={18} color={theme.colors.mutedTypography} />
            </Pressable>
        </HStack>
    );
};
