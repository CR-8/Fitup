import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Pressable } from '@/components/primitives/pressable';
import { useUser } from '@/hooks/use-user';
import { useAccount } from '@/hooks/use-account';

import { greetingKeyForHour } from './salutation';

/**
 * Replaces a heading that said "Home".
 *
 * The name has been sitting on the user row since onboarding without appearing
 * anywhere, and a screen that opens by naming itself tells you nothing you did
 * not know from tapping its tab.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    row: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    text: {
        flexShrink: 1,
        gap: theme.space(0.5),
    },
    salutation: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    tagline: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    avatar: {
        height: '100%',
        width: '100%',
        borderRadius: theme.radius.full,
    },
    dietButton: {
        height: theme.space(11),
        width: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
}));

export const Greeting: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const { session } = useAccount();

    const name = user?.displayName?.trim();
    // Google fills this; an email sign-up has none, and keeps the icon.
    const avatarUrl = session?.user.user_metadata?.avatar_url as string | undefined;
    const salutation = t(`home.greeting.${greetingKeyForHour(new Date().getHours())}`, {
        ns: 'screens',
    });

    return (
        <Box style={styles.container}>
            <HStack style={styles.row}>
                <VStack style={styles.text}>
                    <Text style={styles.salutation}>{salutation}</Text>
                    {/* The name is optional — onboarding can be skipped — so the
                        greeting has to read as a complete sentence without it. */}
                    <Title type="h1" numberOfLines={1}>
                        {name ? `${name} 👋` : t('home.greeting.fallback', { ns: 'screens' })}
                    </Title>
                    <Text style={styles.tagline}>
                        {t('home.greeting.tagline', { ns: 'screens' })}
                    </Text>
                </VStack>

                {/* Settings left the tab bar — it is configuration, not a daily
                    destination — so this is the way in. Nutrition took its place
                    in Home's quick actions below. */}
                <Pressable
                    style={styles.dietButton}
                    onPress={() => router.navigate('/settings')}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.title', { ns: 'screens' })}
                >
                    {avatarUrl ? (
                        <ExpoImage source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <Settings
                            size={theme.space(5)}
                            strokeWidth={theme.space(0.375)}
                            opacity={0.8}
                            color={theme.colors.typography}
                        />
                    )}
                </Pressable>
            </HStack>
        </Box>
    );
};
