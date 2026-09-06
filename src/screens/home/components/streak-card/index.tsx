import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

/**
 * The streak, as an achievement rather than a statistic.
 *
 * The number is `computeStreakDays` over completed workout rows — never a
 * constant. At zero it says what earns one instead of showing a nought, which
 * is the difference between an empty state and a bad score.
 */

const styles = StyleSheet.create((theme, rt) => ({
    card: {
        paddingHorizontal: theme.space(4),
    },
    body: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(3.5),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        paddingHorizontal: theme.space(5),
        paddingVertical: theme.space(4),
    },
    icon: {
        height: theme.space(11),
        width: theme.space(11),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    value: {
        ...theme.fontSize['3xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    label: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    accent: {
        color: rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700],
    },
}));

export const StreakCard: FC<{ streak: number }> = ({ streak }) => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();

    const accent = rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700];
    const active = streak > 0;

    return (
        <Box style={styles.card}>
            <HStack style={styles.body}>
                <Box style={styles.icon}>
                    <Flame
                        size={theme.space(5.5)}
                        strokeWidth={2}
                        color={accent}
                        fill={active ? accent : 'transparent'}
                    />
                </Box>

                <VStack style={styles.text}>
                    {active ? (
                        <>
                            <Text style={[styles.value, styles.accent]}>{String(streak)}</Text>
                            <Text style={styles.label}>
                                {t('home.streakLabel', { ns: 'screens' })}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.hint}>
                                {t('home.streakEmpty', { ns: 'screens' })}
                            </Text>
                        </>
                    )}
                </VStack>
            </HStack>
        </Box>
    );
};
