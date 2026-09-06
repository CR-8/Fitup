import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Apple, Dumbbell, MessageCircle, type LucideIcon } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';

/**
 * Shortcuts to the three destinations Home does not already lead to.
 *
 * Deliberately a compact row rather than four dashboard tiles: starting a
 * workout is the card above, and these are the secondary moves. Every one of
 * them points at a screen that exists.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    row: {
        gap: theme.space(3),
    },
    action: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(1.5),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        paddingVertical: theme.space(3.5),
        paddingHorizontal: theme.space(2),
    },
    icon: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
    },
    label: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
        textAlign: 'center',
    },
}));

export const QuickActions: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    const actions: { key: string; icon: LucideIcon; label: string; go: () => void }[] = [
        {
            key: 'exercises',
            icon: Dumbbell,
            label: t('home.quick.exercises', { ns: 'screens' }),
            go: () => router.navigate('/exercises'),
        },
        {
            key: 'tony',
            icon: MessageCircle,
            label: t('home.quick.tony', { ns: 'screens' }),
            go: () => router.navigate('/tony'),
        },
        {
            key: 'nutrition',
            icon: Apple,
            label: t('home.quick.nutrition', { ns: 'screens' }),
            go: () => router.navigate('/diet'),
        },
    ];

    return (
        <Box style={styles.container}>
            <HStack style={styles.row}>
                {actions.map((action) => (
                    <Pressable
                        key={action.key}
                        style={styles.action}
                        onPress={action.go}
                        accessibilityRole="button"
                        accessibilityLabel={action.label}
                    >
                        <VStack style={styles.icon}>
                            <action.icon
                                size={theme.space(4.5)}
                                strokeWidth={2}
                                color={theme.colors.primary}
                            />
                        </VStack>
                        <Text style={styles.label} numberOfLines={1}>
                            {action.label}
                        </Text>
                    </Pressable>
                ))}
            </HStack>
        </Box>
    );
};
