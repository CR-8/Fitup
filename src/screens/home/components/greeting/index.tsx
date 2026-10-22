import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { useUnreadNotifications } from '@/hooks/use-notification-log';
import { ACCENT } from '@/screens/home/summary';

/**
 * Today's header: a large title over the date, and on the trailing edge the
 * inbox (a red dot while something is unread) and the avatar, which opens
 * the Profile tab.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    text: {
        flex: 1,
    },
    title: {
        fontSize: 34,
        lineHeight: 41,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    date: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.mutedTypography,
    },
    actions: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    round: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.neutral[600],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.neutral[900],
    },
    dot: {
        position: 'absolute',
        top: 9,
        right: 10,
        height: 9,
        width: 9,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: theme.colors.neutral[900],
        backgroundColor: theme.colors.primary,
    },
    avatar: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT.distance,
    },
}));

export const Greeting: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const unread = useUnreadNotifications();

    return (
        <HStack style={styles.container}>
            <VStack style={styles.text}>
                <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                    {t('home.dash.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.date} numberOfLines={1}>
                    {dayjs().locale(i18n.language).format('dddd, D MMM')}
                </Text>
            </VStack>

            <HStack style={styles.actions}>
                <Pressable
                    style={styles.round}
                    onPress={() => router.navigate('/inbox' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('inbox.open', { ns: 'screens' })}
                    accessibilityHint={
                        unread > 0 ? t('inbox.unread', { ns: 'screens' }) : undefined
                    }
                >
                    <Icon name="bell" size={20} color={theme.colors.typography} />
                    {unread > 0 ? <Box style={styles.dot} /> : null}
                </Pressable>
                <Pressable
                    style={styles.avatar}
                    onPress={() => router.navigate('/you' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.openProfile', { ns: 'screens' })}
                >
                    <Icon name="person-fill" size={24} color={theme.colors.neutral[950]} />
                </Pressable>
            </HStack>
        </HStack>
    );
};
