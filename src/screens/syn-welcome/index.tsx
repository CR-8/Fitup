import { FC } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { Stack } from '@/navigators/stack';
import { storage } from '@/storage';
import { ACCENT } from '@/screens/home/summary';

/**
 * Welcome to Syn, after Apple's Welcome to Fitness+: what Syn does, that it is
 * an AI and can be wrong, and what it sends to build a plan. Shown before the
 * first use of Syn (the Coach tab or Build Your Plan); Continue records that it
 * was seen, on this device.
 */

const SEEN_KEY = 'syn.welcomeSeen';

export const hasSeenSynWelcome = (): boolean => storage.getBoolean(SEEN_KEY) === true;

const ROWS: { key: string; icon: IconName }[] = [
    { key: 'plans', icon: 'dumbbell' },
    { key: 'review', icon: 'check' },
    { key: 'caution', icon: 'heart' },
];

const LIME = ACCENT.distance;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: theme.space(6),
        paddingTop: Platform.OS === 'android' ? rt.insets.top + theme.space(12) : theme.space(12),
        paddingBottom: theme.space(4),
        gap: theme.space(8),
    },
    title: {
        fontSize: 32,
        lineHeight: 38,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
    },
    rows: {
        gap: theme.space(7),
    },
    row: {
        alignItems: 'flex-start',
        gap: theme.space(4),
    },
    badge: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: LIME,
    },
    rowText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    rowTitle: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    rowBody: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    footer: {
        alignItems: 'center',
        gap: theme.space(2),
        paddingHorizontal: theme.space(6),
        paddingBottom: rt.insets.bottom + theme.space(3),
    },
    data: {
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    link: {
        fontSize: 12,
        lineHeight: 16,
        color: LIME,
    },
    button: {
        alignSelf: 'stretch',
        marginTop: theme.space(3),
    },
}));

const SynWelcomeScreen: FC = () => {
    const { t } = useTranslation(['screens']);

    const accept = () => {
        storage.set(SEEN_KEY, true);
        router.back();
    };

    return (
        <Box style={styles.container}>
            {/* No bar: Continue is the only way on, as on Apple's welcome. */}
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title} accessibilityRole="header">
                    {t('synWelcome.title', { ns: 'screens' })}
                </Text>
                <VStack style={styles.rows}>
                    {ROWS.map(({ key, icon }) => (
                        <HStack key={key} style={styles.row}>
                            <Box style={styles.badge}>
                                <Icon name={icon} size={22} color="#08090b" />
                            </Box>
                            <VStack style={styles.rowText}>
                                <Text style={styles.rowTitle}>
                                    {t(`synWelcome.rows.${key}.title`, { ns: 'screens' })}
                                </Text>
                                <Text style={styles.rowBody}>
                                    {t(`synWelcome.rows.${key}.body`, { ns: 'screens' })}
                                </Text>
                            </VStack>
                        </HStack>
                    ))}
                </VStack>
            </ScrollView>

            <VStack style={styles.footer}>
                <Icon name="person-circle" size={28} color={LIME} />
                <Text style={styles.data}>{t('synWelcome.data', { ns: 'screens' })}</Text>
                <Pressable
                    onPress={() =>
                        Alert.alert(
                            t('synWelcome.dataTitle', { ns: 'screens' }),
                            t('synWelcome.dataDetail', { ns: 'screens' }),
                        )
                    }
                    accessibilityRole="button"
                >
                    <Text style={styles.link}>{t('synWelcome.dataLink', { ns: 'screens' })}</Text>
                </Pressable>
                <Button
                    type="primary"
                    title={t('synWelcome.continue', { ns: 'screens' })}
                    containerStyle={styles.button}
                    onPress={accept}
                />
            </VStack>
        </Box>
    );
};

export default SynWelcomeScreen;
