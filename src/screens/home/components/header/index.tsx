import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Salad } from 'lucide-react-native';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    row: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    dietButton: {
        height: theme.space(10),
        width: theme.space(10),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
    },
}));

export const Header: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <Box style={styles.container}>
            <HStack style={styles.row}>
                <Title type="h1">{t('home.title', { ns: 'screens' })}</Title>

                <Pressable
                    style={styles.dietButton}
                    onPress={() => router.navigate('/diet')}
                    accessibilityRole="button"
                    accessibilityLabel={t('diet.title', { ns: 'screens' })}
                >
                    <Salad
                        size={theme.space(5)}
                        strokeWidth={theme.space(0.375)}
                        opacity={0.8}
                        color={theme.colors.typography}
                    />
                </Pressable>
            </HStack>
        </Box>
    );
};
