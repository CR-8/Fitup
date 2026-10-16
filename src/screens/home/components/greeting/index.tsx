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
import { Title } from '@/components/typography/title';
import { useUnreadNotifications } from '@/hooks/use-notification-log';
import { useUser } from '@/hooks/use-user';

import { greetingKeyForHour } from './salutation';

/**
 * Today's header: the date over a large "Today", who it is for, and the inbox
 * and profile on the trailing edge. No native bar here; the screen insets it
 * from the status bar itself.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    actions: {
        alignItems: 'center',
    },
    bell: {
        height: theme.space(11),
        width: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadDot: {
        position: 'absolute',
        top: theme.space(2.5),
        right: theme.space(2.5),
        height: theme.space(2),
        width: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brand[500],
    },
    date: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
        color: theme.colors.mutedTypography,
    },
    salutation: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

export const Greeting: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { user } = useUser();
    const { theme } = useUnistyles();
    const unread = useUnreadNotifications();
    const name = user?.displayName?.trim();
    const now = new Date();
    const salutation = t(`home.greeting.${greetingKeyForHour(now.getHours())}`, { ns: 'screens' });

    return (
        <HStack style={styles.container}>
            <VStack style={styles.text}>
                <Text style={styles.date}>
                    {dayjs(now).locale(i18n.language).format('dddd, D MMM')}
                </Text>
                <Title type="h1" numberOfLines={1} accessibilityRole="header">
                    {t('home.today', { ns: 'screens' })}
                </Title>
                {/* The name is optional (onboarding can be skipped), so the line
                has to read as complete without it. */}
                <Text style={styles.salutation} numberOfLines={1}>
                    {name
                        ? `${salutation}, ${name}`
                        : t('home.greeting.fallback', { ns: 'screens' })}
                </Text>
            </VStack>

            <HStack style={styles.actions}>
                <Pressable
                    style={styles.bell}
                    onPress={() => router.navigate('/inbox' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('inbox.open', { ns: 'screens' })}
                    accessibilityHint={
                        unread > 0 ? t('inbox.unread', { ns: 'screens' }) : undefined
                    }
                >
                    <Icon name="bell" size={theme.space(6)} color={theme.colors.mutedTypography} />
                    {unread > 0 ? <Box style={styles.unreadDot} /> : null}
                </Pressable>
                <Pressable
                    style={styles.bell}
                    onPress={() => router.navigate('/you' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.openProfile', { ns: 'screens' })}
                >
                    <Icon name="person-circle" size={theme.space(7)} color={theme.colors.primary} />
                </Pressable>
            </HStack>
        </HStack>
    );
};
