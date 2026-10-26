import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';

/**
 * Syn's header, drawn like Today's: the large title over a short line, and on
 * the trailing edge round buttons for the saved plans and, once there is a
 * conversation, starting a new one. The tab's native bar is hidden for it.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        paddingBottom: theme.space(3),
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
    subtitle: {
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
}));

export const SynHeader: FC<{ onClear?: () => void }> = ({ onClear }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();

    return (
        <HStack style={styles.container}>
            <VStack style={styles.text}>
                <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                    {t('syn.title')}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                    {t('syn.eyebrow')}
                </Text>
            </VStack>

            <HStack style={styles.actions}>
                <Pressable
                    style={styles.round}
                    onPress={() => router.navigate('/coach/plans' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={t('coach.plans.title')}
                >
                    <Icon name="calendar" size={19} color={theme.colors.typography} />
                </Pressable>
                {onClear ? (
                    <Pressable
                        style={styles.round}
                        onPress={onClear}
                        accessibilityRole="button"
                        accessibilityLabel={t('syn.clear.new')}
                    >
                        <Icon name="plus" size={20} color={theme.colors.typography} />
                    </Pressable>
                ) : null}
            </HStack>
        </HStack>
    );
};
