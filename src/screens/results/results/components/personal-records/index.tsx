import { FC, Fragment, useMemo, useState } from 'react';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { Title } from '@/components/typography/title';
import { usePersonalRecords } from '@/hooks/use-exercises';
import { exerciseDisplayName } from '@/helpers/exercise-name';
import { formatSet } from '@/helpers/workouts';

/**
 * The best set on record for every exercise, under the calendar.
 *
 * The Monthly Tracker's second job after "which days did I train": "what have I
 * got stronger at". Newest record first, so this month's wins lead and carry a
 * badge; a row opens the exercise, whose history shows the same best set.
 */

/** Enough to read at a glance; the rest are one tap away. */
const COLLAPSED_COUNT = 6;

const styles = StyleSheet.create((theme) => ({
    section: {
        gap: theme.space(3),
    },
    header: {
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(1),
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingVertical: theme.space(3),
    },
    badge: (isNew: boolean) => ({
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: isNew ? theme.colors.primarySoft : theme.colors.inset,
    }),
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    name: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    meta: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    date: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    value: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
    },
    newPill: {
        ...theme.fontSize['2xs'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.primary,
        textTransform: 'uppercase',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: theme.space(12),
        backgroundColor: theme.colors.border,
    },
    toggle: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.space(3),
    },
    toggleText: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.primary,
    },
    empty: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingVertical: theme.space(5),
    },
    emptyText: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
}));

export const PersonalRecords: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { data: records = [] } = usePersonalRecords();
    const [expanded, setExpanded] = useState(false);

    const monthStart = useMemo(() => dayjs().startOf('month'), []);
    const newThisMonth = records.filter((record) => !dayjs(record.achievedAt).isBefore(monthStart));
    const visible = expanded ? records : records.slice(0, COLLAPSED_COUNT);

    return (
        <VStack style={styles.section}>
            <HStack style={styles.header}>
                <Title type="h4">{t('results.records.title', { ns: 'screens' })}</Title>
                {newThisMonth.length > 0 ? (
                    <Text style={styles.subtitle}>
                        {t('results.records.newThisMonth', {
                            ns: 'screens',
                            count: newThisMonth.length,
                        })}
                    </Text>
                ) : null}
            </HStack>

            <VStack style={styles.card}>
                {records.length === 0 ? (
                    <VStack style={styles.empty}>
                        <Icon name="trophy" size={theme.space(6)} color={theme.colors.primary} />
                        <Text style={styles.emptyText}>
                            {t('results.records.empty', { ns: 'screens' })}
                        </Text>
                    </VStack>
                ) : null}

                {visible.map((record, index) => {
                    const isNew = !dayjs(record.achievedAt).isBefore(monthStart);

                    return (
                        <Fragment key={record.exercise.id}>
                            {index > 0 ? <Box style={styles.divider} /> : null}
                            <Pressable
                                onPress={() => router.navigate(`/exercises/${record.exercise.id}`)}
                                accessibilityRole="button"
                            >
                                <HStack style={styles.row}>
                                    <Box style={styles.badge(isNew)}>
                                        <Icon
                                            name="trophy"
                                            size={theme.space(4.5)}
                                            color={
                                                isNew
                                                    ? theme.colors.primary
                                                    : theme.colors.mutedTypography
                                            }
                                        />
                                    </Box>
                                    <VStack style={styles.text}>
                                        <Text style={styles.name} numberOfLines={1}>
                                            {exerciseDisplayName(record.exercise)}
                                        </Text>
                                        <HStack style={styles.meta}>
                                            {isNew ? (
                                                <Text style={styles.newPill}>
                                                    {t('results.records.new', { ns: 'screens' })}
                                                </Text>
                                            ) : null}
                                            <Text style={styles.date}>
                                                {dayjs(record.achievedAt).format('D MMM YYYY')}
                                            </Text>
                                        </HStack>
                                    </VStack>
                                    <Text style={styles.value}>
                                        {formatSet(record.exercise, record.set)}
                                    </Text>
                                </HStack>
                            </Pressable>
                        </Fragment>
                    );
                })}

                {records.length > COLLAPSED_COUNT ? (
                    <Pressable onPress={() => setExpanded((value) => !value)}>
                        <HStack style={styles.toggle}>
                            <Text style={styles.toggleText}>
                                {expanded
                                    ? t('results.records.showLess', { ns: 'screens' })
                                    : t('results.records.showAll', {
                                          ns: 'screens',
                                          count: records.length,
                                      })}
                            </Text>
                        </HStack>
                    </Pressable>
                ) : null}
            </VStack>
        </VStack>
    );
};
