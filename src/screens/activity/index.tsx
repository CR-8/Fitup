import { FC, ReactNode, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import dayjs from 'dayjs';

import { toDateKey } from '@/crud/nutrition';
import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { HeaderButton } from '@/components/buttons/header';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { startOfWeekMs } from '@/helpers/workouts';
import { useTodayKey } from '@/hooks/use-water';
import { useUser } from '@/hooks/use-user';
import { AXIS_HOURS } from '@/screens/calories';
import { Bars, Metric, Rings } from '@/screens/home/components/charts';
import {
    ACCENT,
    useActivityDays,
    useMovementHours,
    useMovementSummary,
} from '@/screens/home/summary';

/**
 * Today's dial opened up, after Apple Fitness's ring detail: the week's rings
 * (a day picks it, the calendar goes further back), the day's rings large,
 * then each ring's figure against its goal with its day hour by hour, and the
 * day's steps. The sessions ring is the week's, as on the dial.
 */

/** The day on show; the week strip and the calendar both set it. */
export const useActivityStore = create<{ day: string; setDay: (day: string) => void }>()((set) => ({
    day: '',
    setDay: (day) => set({ day }),
}));

/** "1.5", "2", "0.25": a figure without trailing zeros. */
const trim = (value: number, digits = 1) => String(Number(value.toFixed(digits)));

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
        backgroundColor: selected ? ACCENT.distance : 'transparent',
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
        backgroundColor: visible ? ACCENT.distance : 'transparent',
    }),
    bigRings: {
        alignItems: 'center',
        paddingVertical: theme.space(4),
    },
    section: {
        gap: theme.space(3),
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
    total: (color: string) => ({
        ...theme.typography.eyebrow,
        marginTop: -theme.space(2),
        textTransform: 'uppercase',
        color,
    }),
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
    },
    pair: {
        justifyContent: 'space-between',
    },
}));

/** One ring's block: its name, the figure against its goal, and a chart under it. */
const Section: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <VStack style={styles.section}>
        <Text style={styles.label}>{label}</Text>
        {children}
    </VStack>
);

const HourAxis: FC = () => (
    <HStack style={styles.axis}>
        {AXIS_HOURS.map((hour) => (
            <Text key={hour} style={styles.axisLabel}>
                {dayjs().startOf('day').add(hour, 'hour').format('h A')}
            </Text>
        ))}
    </HStack>
);

const ActivityScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const today = useTodayKey();
    const day = useActivityStore((state) => state.day) || today;
    const setDay = useActivityStore((state) => state.setDay);
    const { user } = useUser();
    const { access, connect } = useMovementSummary('today', today);

    // Opened from the dial it is always today; a day picked last time is not kept.
    useEffect(() => () => setDay(''), [setDay]);

    const monday = dayjs(startOfWeekMs(user?.firstWeekday || 2, dayjs(day).toDate()));
    const week = Array.from({ length: 7 }, (_, i) => toDateKey(monday.add(i, 'day').toDate()));
    const activity = useActivityDays(week[0], week[6]);
    const selected = activity.dayFor(day);
    const granted = access === 'granted';
    const hours = useMovementHours(day, granted);
    const isToday = day === today;
    const nowHour = isToday ? dayjs().hour() : -1;

    const waterByHour = useMemo(() => {
        const series = Array.from({ length: 24 }, () => 0);
        activity.logs
            .filter((log) => log.date === day)
            .forEach((log) => (series[dayjs(log.createdAt).hour()] += log.amountMl));

        return series;
    }, [activity.logs, day]);

    const sessionsByDay = week.map((date) => activity.dayFor(date).sessions);

    const date = dayjs(day).locale(i18n.language);
    const title = isToday
        ? t('activity.today', { ns: 'screens', date: date.format('D MMM YYYY') })
        : date.format('ddd, D MMM YYYY');

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={title}
                done={false}
                right={
                    <HeaderButton
                        icon="calendar"
                        onPress={() => router.navigate('/activity-calendar' as never)}
                        accessibilityLabel={t('activity.openCalendar', { ns: 'screens' })}
                    />
                }
            />

            <HStack style={styles.week}>
                {week.map((date) => {
                    const isSelected = date === day;

                    return (
                        <Pressable
                            key={date}
                            style={styles.weekday}
                            onPress={() => setDay(date)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={dayjs(date).locale(i18n.language).format('dddd')}
                        >
                            <Box style={styles.letter(isSelected)}>
                                <Text style={styles.letterText(isSelected)}>
                                    {dayjs(date).locale(i18n.language).format('dd').charAt(0)}
                                </Text>
                            </Box>
                            <Box style={styles.todayDot(date === today)} />
                            <Rings rings={activity.dayFor(date).rings} size={38} />
                        </Pressable>
                    );
                })}
            </HStack>

            <Box style={styles.bigRings}>
                <Rings rings={selected.rings} size={240} />
            </Box>

            <Section label={t('home.dash.water', { ns: 'screens' })}>
                <Metric
                    value={`${trim(selected.waterMl / 1000, 2)}/${trim(activity.targetMl / 1000, 2)}`}
                    unit="L"
                    color={ACCENT.water}
                />
                <Bars data={waterByHour} current={nowHour} color={ACCENT.water} />
                <HourAxis />
                <Text style={styles.total(ACCENT.water)}>
                    {t('activity.total', {
                        ns: 'screens',
                        total: `${Math.round(selected.waterMl)} ml`,
                    })}
                </Text>
            </Section>

            <Box style={styles.divider} />

            <Section label={t('home.dash.distance', { ns: 'screens' })}>
                <Metric
                    value={`${selected.distance === null ? '–' : trim(selected.distance, 2)}/${activity.distanceGoal}`}
                    unit={activity.distanceUnit}
                    color={ACCENT.distance}
                />
                {hours.distance ? (
                    <>
                        <Bars data={hours.distance} current={nowHour} color={ACCENT.distance} />
                        <HourAxis />
                    </>
                ) : access === 'ask' || access === 'install' ? (
                    <Button
                        title={t(access === 'install' ? 'health.install' : 'health.connect', {
                            ns: 'screens',
                        })}
                        onPress={connect}
                    />
                ) : null}
            </Section>

            <Box style={styles.divider} />

            <Section label={t('activity.sessions', { ns: 'screens' })}>
                <Metric
                    value={`${selected.weekSessions}/${activity.target}`}
                    color={ACCENT.sessions}
                />
                <Bars data={sessionsByDay} current={week.indexOf(day)} color={ACCENT.sessions} />
                <HStack style={styles.axis}>
                    {week.map((date) => (
                        <Text key={date} style={[styles.axisLabel, { textAlign: 'center' }]}>
                            {dayjs(date).locale(i18n.language).format('dd').charAt(0)}
                        </Text>
                    ))}
                </HStack>
            </Section>

            <Box style={styles.divider} />

            <HStack style={styles.pair}>
                <VStack>
                    <Text style={styles.label}>{t('activity.steps', { ns: 'screens' })}</Text>
                    <Metric
                        value={
                            selected.steps === null
                                ? '–'
                                : Math.round(selected.steps).toLocaleString(i18n.language)
                        }
                        color={theme.colors.neutral[50]}
                        size={28}
                    />
                </VStack>
                <VStack>
                    <Text style={styles.label}>
                        {t('activity.sessionsToday', { ns: 'screens' })}
                    </Text>
                    <Metric
                        value={String(selected.sessions)}
                        color={theme.colors.neutral[50]}
                        size={28}
                    />
                </VStack>
            </HStack>
        </ScrollView>
    );
};

export default ActivityScreen;
