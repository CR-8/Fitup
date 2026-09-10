import { FC, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { useAiAvailable, useSynActions } from '@/hooks/use-ai';
import type { AiPlanKind } from '@/constants/ai';

/**
 * The offer to have Syn write the plan, at the top of Home.
 *
 * Home previously led with the streak, which is a reward for work already done.
 * This leads with the thing the app is for, and it is the one surface where the
 * monthly allowance is worth stating up front: generating is the most expensive
 * action in the product and the only one with a hard limit, so the count sits
 * under the button rather than behind an error after the tap.
 *
 * The three chips are presets over the same call, not separate features — each
 * one is a kind plus an intent sentence. `useSynActions` owns the quota guard
 * and the chat, so the generation appears in the Syn thread as though it had
 * been asked for there, which is where the answer arrives.
 */

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(5),
        gap: theme.space(3),
        ...theme.shadows.soft,
    },
    header: {
        alignItems: 'center',
        gap: theme.space(2.5),
    },
    badge: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    action: {
        marginTop: theme.space(1),
    },
    buttonTitle: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
    },
    quota: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
    quotaExhausted: {
        color: theme.colors.destructive,
    },
    chips: {
        gap: theme.space(2),
        flexWrap: 'wrap',
    },
    chip: {
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.space(3.5),
        paddingVertical: theme.space(2),
    },
    chipDisabled: {
        opacity: 0.4,
    },
    chipLabel: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    },
}));

/**
 * A week, which is the default horizon everywhere else in the app and what the
 * model reliably fits inside one response. Longer plans are the retry path in
 * `useAiChat`, not something to ask for from a chip.
 */
const PLAN_HORIZON_DAYS = 7;

export const AiPlanCard: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const available = useAiAvailable();
    const { generate, quota, exhausted, isGenerating } = useSynActions();

    const start = useCallback(
        (kind: AiPlanKind, intentKey: string) => {
            // Only navigate if the request actually began — `generate` refuses
            // when the allowance is spent, and sending someone to an empty
            // thread would read as the app having lost the tap.
            if (generate(kind, t(intentKey, { ns: 'screens' }), PLAN_HORIZON_DAYS)) {
                router.navigate('/syn');
            }
        },
        [generate, t],
    );

    const chips = useMemo(
        () => [
            { key: 'week', kind: 'workout' as AiPlanKind, intent: 'home.ai.chips.weekIntent' },
            { key: 'cut', kind: 'combined' as AiPlanKind, intent: 'home.ai.chips.cutIntent' },
            { key: 'food', kind: 'nutrition' as AiPlanKind, intent: 'home.ai.chips.foodIntent' },
        ],
        [],
    );

    // Nothing here works without a configured host, and an offer that cannot be
    // taken up is worse than no offer.
    if (!available) return null;

    return (
        <VStack style={styles.container}>
            <HStack style={styles.header}>
                <Box style={styles.badge}>
                    <Sparkles
                        size={theme.space(4.5)}
                        strokeWidth={2}
                        color={theme.colors.primary}
                    />
                </Box>
                <Title type="h5">{t('home.ai.title', { ns: 'screens' })}</Title>
            </HStack>

            <Text style={styles.description}>{t('home.ai.description', { ns: 'screens' })}</Text>

            <Box style={styles.action}>
                <Button
                    onPress={() => start('workout', 'home.ai.chips.weekIntent')}
                    loading={isGenerating}
                    disabled={exhausted || isGenerating}
                    title={t('home.ai.action', { ns: 'screens' })}
                    textStyle={styles.buttonTitle}
                    accessibilityLabel={t('home.ai.action', { ns: 'screens' })}
                />
            </Box>

            <Text style={[styles.quota, exhausted && styles.quotaExhausted]}>
                {t('syn.quota.remaining', {
                    ns: 'screens',
                    remaining: quota.remaining,
                    limit: quota.limit,
                })}
            </Text>

            <HStack style={styles.chips}>
                {chips.map((chip) => (
                    <Pressable
                        key={chip.key}
                        style={[styles.chip, (exhausted || isGenerating) && styles.chipDisabled]}
                        disabled={exhausted || isGenerating}
                        onPress={() => start(chip.kind, chip.intent)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.chipLabel}>
                            {t(`home.ai.chips.${chip.key}`, { ns: 'screens' })}
                        </Text>
                    </Pressable>
                ))}
            </HStack>
        </VStack>
    );
};
