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
import { useAnalytics } from '@/hooks/use-analytics';
import { useEditor } from '@/hooks/use-editor';
import { useUnreadNotifications } from '@/hooks/use-notification-log';

/**
 * Today's header, after Apple Fitness's Summary: a large title over the date,
 * and on the trailing edge a new workout, the inbox and the profile (settings).
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
        gap: theme.space(2),
    },
    round: {
        height: 40,
        width: 40,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.elevated,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
    },
    badgeText: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.white,
    },
}));

export const Greeting: FC<{ accent: string }> = ({ accent }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const unread = useUnreadNotifications();
    const { navigate } = useEditor();
    const { track } = useAnalytics();

    return (
        <HStack style={styles.container}>
            <VStack style={styles.text}>
                <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                    {t('home.dash.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.date} numberOfLines={1}>
                    {dayjs().locale(i18n.language).format('dddd, MMM D')}
                </Text>
            </VStack>

            <HStack style={styles.actions}>
                <Pressable
                    style={styles.round}
                    onPress={() => {
                        track('workout:create_requested', { surface: 'home_header' });
                        navigate({ type: 'workout__create' });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.dash.newWorkout', { ns: 'screens' })}
                >
                    <Icon name="plus" size={20} color={theme.colors.typography} />
                </Pressable>
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
                    {unread > 0 ? (
                        <Box style={styles.badge}>
                            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                        </Box>
                    ) : null}
                </Pressable>
                <Pressable
                    onPress={() => router.navigate('/settings' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.openProfile', { ns: 'screens' })}
                >
                    <Icon name="person-circle" size={44} color={accent} />
                </Pressable>
            </HStack>
        </HStack>
    );
};
