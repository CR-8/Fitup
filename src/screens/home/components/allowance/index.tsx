import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { useAiAvailable, useAiQuota } from '@/hooks/use-ai';

/**
 * One quiet line for the month's AI plan builds, the only thing in the app
 * with a limit. Opens the quota screen; never blocks anything on Today.
 */

const styles = StyleSheet.create((theme) => ({
    row: {
        marginHorizontal: theme.space(4),
        minHeight: 44,
        alignItems: 'center',
        gap: theme.space(2),
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    flush: {
        marginHorizontal: 0,
    },
    text: {
        ...theme.fontSize.sm,
        flex: 1,
        color: theme.colors.mutedTypography,
    },
}));

/** `inset={false}` where the parent already pads the row, as Coach does. */
export const AllowanceRow: FC<{ inset?: boolean }> = ({ inset = true }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const available = useAiAvailable();
    const quota = useAiQuota();

    if (!available) return null;

    const label = t('quota.left', {
        ns: 'screens',
        count: quota.remaining,
        limit: quota.limit,
    });

    return (
        <Pressable
            onPress={() => router.navigate('/quota' as never)}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <HStack style={[styles.row, !inset && styles.flush]}>
                <Icon name="sparkles" size={16} color={theme.colors.mutedTypography} />
                <Text style={styles.text}>{label}</Text>
                <Icon name="chevron-right" size={14} color={theme.colors.mutedTypography} />
            </HStack>
        </Pressable>
    );
};
