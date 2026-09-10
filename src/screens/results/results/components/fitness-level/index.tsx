import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import type { FitnessLevel } from '@/helpers/fitness-level';

/**
 * The measured read of how far along someone's training is — computed by
 * `resolveFitnessLevel` (src/helpers/fitness-level.ts) from the same
 * `useWorkoutStats` figures the rest of this screen already shows, not a
 * separate query and not self-reported. It is also what Syn calibrates a
 * plan's volume and complexity against; showing it here is the same number in
 * both places, not a UI restating something the model privately decided.
 *
 * Styled after `StreakCard` (src/screens/home/components/streak-card) —
 * icon circle, accent value, quiet label — the app's established shape for
 * "one qualitative fact about training", as distinct from the numeric tiles
 * in `StatBlocks`.
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
        ...theme.fontSize.lg,
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

export const FitnessLevelCard: FC<{ level: FitnessLevel | null }> = ({ level }) => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();

    const accent = rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700];

    return (
        <Box style={styles.card}>
            <HStack style={styles.body}>
                <Box style={styles.icon}>
                    <TrendingUp size={theme.space(5.5)} strokeWidth={2} color={accent} />
                </Box>

                <VStack style={styles.text}>
                    {level ? (
                        <>
                            <Text style={[styles.value, styles.accent]}>
                                {t(`results.fitnessLevel.value.${level}`, { ns: 'screens' })}
                            </Text>
                            <Text style={styles.label}>
                                {t('results.fitnessLevel.label', { ns: 'screens' })}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.hint}>
                            {t('results.fitnessLevel.empty', { ns: 'screens' })}
                        </Text>
                    )}
                </VStack>
            </HStack>
        </Box>
    );
};
