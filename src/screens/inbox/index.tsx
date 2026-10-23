import { FC, useEffect, useMemo } from 'react';
import { router, type Href } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { ScrollView } from '@/components/primitives/scrollview';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import type { NotificationLogSelect } from '@/db/schema';
import { useNotificationLog } from '@/hooks/use-notification-log';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    group: {
        gap: theme.space(2),
    },
    // The reference's grouped lists: a small uppercase heading, then the
    // period's rows on one card with hairlines between them.
    groupTitle: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
        color: theme.colors.mutedTypography,
        paddingHorizontal: theme.space(4),
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        overflow: 'hidden',
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.space(16),
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: theme.space(17),
        backgroundColor: theme.colors.border,
    },
    iconTile: (tint: string) => ({
        height: theme.space(10),
        width: theme.space(10),
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${tint}2e`,
    }),
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    body: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    side: {
        alignItems: 'flex-end',
        gap: theme.space(1.5),
    },
    time: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    // Red is reserved for "unread".
    unread: {
        height: theme.space(2),
        width: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brand[500],
    },
    empty: {
        alignItems: 'center',
        gap: theme.space(2),
        paddingTop: theme.space(16),
    },
    emptyTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    emptyHint: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
        maxWidth: '80%',
    },
}));

const ICONS: Record<NotificationLogSelect['kind'], IconName> = {
    reminder: 'bell',
    plan: 'calendar',
    milestone: 'target',
};

/** Each kind keeps one colour, so a reminder always looks like a reminder. */
const TINTS = (theme: ReturnType<typeof useUnistyles>['theme']) =>
    ({
        reminder: theme.colors.brand[500],
        plan: theme.colors.training.core,
        milestone: theme.colors.amber[400],
    }) satisfies Record<NotificationLogSelect['kind'], string>;

type Group = { key: 'today' | 'thisWeek' | 'earlier'; rows: NotificationLogSelect[] };

const groupRows = (rows: NotificationLogSelect[]): Group[] => {
    const now = dayjs();
    const groups: Group[] = [
        { key: 'today', rows: [] },
        { key: 'thisWeek', rows: [] },
        { key: 'earlier', rows: [] },
    ];

    for (const row of rows) {
        const at = dayjs(row.createdAt);
        const bucket = at.isSame(now, 'day') ? 0 : now.diff(at, 'day') < 7 ? 1 : 2;
        groups[bucket].rows.push(row);
    }

    return groups.filter((group) => group.rows.length > 0);
};

const NotificationsScreen: FC = () => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const { notifications, markRead } = useNotificationLog();

    const groups = useMemo(() => groupRows(notifications), [notifications]);
    const ago = (date: Date) => {
        const minutes = Math.max(0, dayjs().diff(date, 'minute'));
        if (minutes < 60) return t('inbox.ago.minutes', { count: Math.max(1, minutes) });
        if (minutes < 1440) return t('inbox.ago.hours', { count: Math.floor(minutes / 60) });

        return t('inbox.ago.days', { count: Math.floor(minutes / 1440) });
    };

    // What was on screen counts as seen once the person leaves it, so the red dots
    // are still there while they are being read.
    useEffect(() => () => void markRead(), [markRead]);

    if (notifications.length === 0) {
        return (
            <VStack style={[styles.container, styles.empty]}>
                <Icon name="bell" size={theme.space(10)} color={theme.colors.mutedTypography} />
                <Text style={styles.emptyTitle}>{t('inbox.empty')}</Text>
                <Text style={styles.emptyHint}>{t('inbox.emptyHint')}</Text>
            </VStack>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {groups.map((group) => (
                <VStack key={group.key} style={styles.group}>
                    <Text style={styles.groupTitle} accessibilityRole="header">
                        {t(`inbox.${group.key}`)}
                    </Text>
                    <VStack style={styles.card}>
                        {group.rows.map((row, index) => (
                            <VStack key={row.id}>
                                {index > 0 ? <Box style={styles.divider} /> : null}
                                <Pressable
                                    disabled={!row.path}
                                    onPress={() => row.path && router.navigate(row.path as Href)}
                                    accessibilityRole={row.path ? 'button' : 'text'}
                                    accessibilityLabel={`${row.readAt ? '' : `${t('inbox.unread')}. `}${row.title}. ${row.body ?? ''}`}
                                >
                                    <HStack style={styles.row}>
                                        <Box style={styles.iconTile(TINTS(theme)[row.kind])}>
                                            <Icon
                                                name={ICONS[row.kind]}
                                                size={theme.space(5)}
                                                color={TINTS(theme)[row.kind]}
                                            />
                                        </Box>
                                        <VStack style={styles.text}>
                                            <Text style={styles.title} numberOfLines={1}>
                                                {row.title}
                                            </Text>
                                            {row.body ? (
                                                <Text style={styles.body} numberOfLines={2}>
                                                    {row.body}
                                                </Text>
                                            ) : null}
                                        </VStack>
                                        <VStack style={styles.side}>
                                            <Text style={styles.time}>{ago(row.createdAt)}</Text>
                                            {row.readAt ? null : <Box style={styles.unread} />}
                                        </VStack>
                                    </HStack>
                                </Pressable>
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            ))}
        </ScrollView>
    );
};

export default NotificationsScreen;
