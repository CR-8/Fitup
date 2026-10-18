import { FC } from 'react';
import { router } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';

/**
 * "‹ Summary": the way back to Today from Syn and Progress, now that they sit
 * beside it with no tab bar. Today is the hub; a swipe right does the same.
 */
export const SummaryButton: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={() => router.navigate('/' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('home.dash.backToSummary', { ns: 'screens' })}
        >
            <HStack style={{ alignItems: 'center', gap: 2, paddingHorizontal: theme.space(1) }}>
                <Icon name="chevron-left" size={18} color={theme.colors.primary} />
                <Text style={{ fontSize: 17, color: theme.colors.primary }}>
                    {t('home.dash.title', { ns: 'screens' })}
                </Text>
            </HStack>
        </Pressable>
    );
};
