import { FC, useCallback } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { useAiAvailable, useSynActions } from '@/hooks/use-ai';
import { Icon } from '@/components/primitives/icon';

/**
 * The way into an AI plan, in the middle of Home.
 *
 * Sized to sit between the weekly tracker and the day's other cards rather than
 * to lead the screen: one line of what it does, one button, and the monthly
 * allowance under it — generating is the one action with a hard limit, so the
 * count is said before the tap rather than in an error after it. The preset
 * chips that used to sit here moved out with the rest of the choice: the AI
 * tab takes a plan request in the user's own words.
 *
 * With a plan already running, the same card offers to adjust it instead. That
 * opens the AI tab rather than spending a generation from Home: "harder",
 * "swap the squats" or "add food" are things to say, not buttons to guess at.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderCurve: 'continuous',
        padding: theme.space(5),
        gap: theme.space(3),
        ...Platform.select({
            ios: {},
            default: { borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.soft },
        }),
    },
    header: {
        alignItems: 'center',
        gap: theme.space(2.5),
    },
    headerText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    badge: {
        height: theme.space(10),
        width: theme.space(10),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    // The tally of finished plans: a small win in the card's own coral.
    milestone: {
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: theme.space(1.5),
        paddingVertical: theme.space(1.5),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
    },
    milestoneText: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
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
}));

/**
 * A week, which is the default horizon everywhere else in the app and what the
 * model reliably fits inside one response.
 */
const PLAN_HORIZON_DAYS = 7;

interface AiPlanCardProps {
    /** Plans already seen through. Above zero, the card reads as "what's next". */
    finishedPlans?: number;
    /** A plan is running: offer to adjust it rather than to start one. */
    hasActivePlan?: boolean;
}

export const AiPlanCard: FC<AiPlanCardProps> = ({ finishedPlans = 0, hasActivePlan = false }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const available = useAiAvailable();
    const { generate, quota, exhausted, isGenerating } = useSynActions();

    const handlePress = useCallback(() => {
        if (hasActivePlan) {
            router.navigate('/syn');
            return;
        }

        // Only navigate if the request actually began — `generate` refuses
        // when the allowance is spent, and sending someone to an empty
        // thread would read as the app having lost the tap.
        if (generate('workout', t('home.ai.intent', { ns: 'screens' }), PLAN_HORIZON_DAYS)) {
            router.navigate('/syn');
        }
    }, [generate, hasActivePlan, t]);

    // Nothing here works without a configured host, and an offer that cannot be
    // taken up is worse than no offer.
    if (!available) return null;

    const copy = hasActivePlan ? 'adjust' : finishedPlans > 0 ? 'next' : 'new';
    const action = t(`home.ai.${copy}.action`, { ns: 'screens' });

    return (
        <VStack style={styles.container}>
            {finishedPlans > 0 && !hasActivePlan ? (
                <HStack style={styles.milestone}>
                    <Icon name="trophy" size={theme.space(3.5)} color={theme.colors.primary} />
                    <Text style={styles.milestoneText}>
                        {t('home.ai.finished', { ns: 'screens', count: finishedPlans })}
                    </Text>
                </HStack>
            ) : null}

            <HStack style={styles.header}>
                <Box style={styles.badge}>
                    <Icon name="sparkles" size={theme.space(5)} color={theme.colors.primary} />
                </Box>
                <VStack style={styles.headerText}>
                    <Title type="h5">{t(`home.ai.${copy}.title`, { ns: 'screens' })}</Title>
                    <Text style={styles.description}>
                        {t(`home.ai.${copy}.description`, { ns: 'screens' })}
                    </Text>
                </VStack>
            </HStack>

            <Button
                onPress={handlePress}
                loading={isGenerating}
                disabled={isGenerating || (!hasActivePlan && exhausted)}
                title={action}
                textStyle={styles.buttonTitle}
                accessibilityLabel={action}
            />

            {hasActivePlan ? null : (
                <Text style={[styles.quota, exhausted && styles.quotaExhausted]}>
                    {t('syn.quota.remaining', {
                        ns: 'screens',
                        remaining: quota.remaining,
                        limit: quota.limit,
                    })}
                </Text>
            )}
        </VStack>
    );
};
