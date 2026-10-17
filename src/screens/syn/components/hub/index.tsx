import { FC, ReactNode } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Card } from '@/components/layout/card';
import { SynMark } from '@/components/brand/syn-mark';
import { usePlans } from '@/hooks/use-ai';
import { AllowanceRow } from '@/screens/home/components/allowance';
import { PlanRow } from '@/screens/coach/plans';

/**
 * D01 Coach: the two things Syn builds, each one a choice that leads to a form
 * (never straight to a build), the month's allowance, free questions, and the
 * plans already made. Shown while the thread is empty; the thread takes over
 * once there is a conversation.
 */

const RECENT_PLANS = 3;

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(5),
        paddingVertical: theme.space(2),
    },
    intro: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    introText: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.typography,
        maxWidth: '88%',
    },
    choices: {
        gap: theme.space(3),
    },
    choiceRow: {
        alignItems: 'flex-start',
        gap: theme.space(3),
    },
    badge: {
        height: 44,
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
    },
    choiceText: {
        flex: 1,
        gap: theme.space(1),
    },
    choiceTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    choiceBody: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    cost: {
        ...theme.typography.eyebrow,
        color: theme.colors.primary,
    },
    section: {
        gap: theme.space(2),
    },
    sectionRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
        color: theme.colors.mutedTypography,
    },
    sectionHint: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    link: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
}));

const Choice: FC<{ kind: 'workout' | 'nutrition'; icon: IconName }> = ({ kind, icon }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const title = t(`coach.hub.${kind}.title`, { ns: 'screens' });

    return (
        <Card
            onPress={() =>
                router.navigate(
                    (kind === 'workout'
                        ? '/coach/build'
                        : { pathname: '/coach/new', params: { kind } }) as never,
                )
            }
            accessibilityLabel={title}
            accessibilityHint={t('coach.hub.hint', { ns: 'screens' })}
        >
            <HStack style={styles.choiceRow}>
                <Box style={styles.badge}>
                    <Icon name={icon} size={22} color={theme.colors.primary} />
                </Box>
                <VStack style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>{title}</Text>
                    <Text style={styles.choiceBody}>
                        {t(`coach.hub.${kind}.body`, { ns: 'screens' })}
                    </Text>
                    <Text style={styles.cost}>{t('coach.hub.cost', { ns: 'screens' })}</Text>
                </VStack>
                <Icon name="chevron-right" size={16} color={theme.colors.mutedTypography} />
            </HStack>
        </Card>
    );
};

export const CoachHub: FC<{ freeChips: ReactNode }> = ({ freeChips }) => {
    const { t } = useTranslation(['screens']);
    const { plans } = usePlans();

    return (
        <VStack style={styles.container}>
            <VStack style={styles.intro}>
                <SynMark size={48} />
                <Text style={styles.introText}>{t('syn.coach.intro', { ns: 'screens' })}</Text>
            </VStack>

            <VStack style={styles.choices}>
                <Choice kind="workout" icon="dumbbell" />
                <Choice kind="nutrition" icon="utensils" />
                <AllowanceRow inset={false} />
            </VStack>

            <VStack style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                    {t('coach.hub.ask', { ns: 'screens' })}
                </Text>
                {freeChips}
                <Text style={styles.sectionHint}>{t('coach.hub.askHint', { ns: 'screens' })}</Text>
            </VStack>

            {plans.length > 0 ? (
                <VStack style={styles.section}>
                    <HStack style={styles.sectionRow}>
                        <Text style={styles.sectionTitle} accessibilityRole="header">
                            {t('coach.plans.title', { ns: 'screens' })}
                        </Text>
                        <Pressable
                            onPress={() => router.navigate('/coach/plans' as never)}
                            accessibilityRole="button"
                            hitSlop={8}
                        >
                            <Text style={styles.link}>
                                {t('coach.hub.seeAll', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    </HStack>
                    {plans.slice(0, RECENT_PLANS).map((plan) => (
                        <PlanRow key={plan.id} plan={plan} />
                    ))}
                </VStack>
            ) : null}
        </VStack>
    );
};
