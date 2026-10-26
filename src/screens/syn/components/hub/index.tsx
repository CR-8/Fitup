import { FC } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon, type IconName } from '@/components/primitives/icon';
import { SynMark } from '@/components/brand/syn-mark';
import { Skeleton } from '@/components/feedback/skeleton';
import type { AiPlanSelect } from '@/db/schema';
import { planRange, planStatus } from '@/helpers/ai-plan';
import { useAiQuota, usePlans } from '@/hooks/use-ai';
import { useUser } from '@/hooks/use-user';
import { Ring } from '@/screens/home/components/charts';
import { ACCENT } from '@/screens/home/summary';

/**
 * D01 Coach, in Today's language: a greeting card whose ring is the month's
 * plan builds, the two things Syn builds side by side (each opens its form,
 * never a build), the free questions as one list, and the plans already made.
 * Shown while the thread is empty; the thread takes over once there is one.
 */

const RECENT_PLANS = 3;

export type Question = { key: string; label: string; icon: IconName; run: () => void };

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(6),
        paddingTop: theme.space(1),
        paddingBottom: theme.space(4),
    },
    tile: {
        padding: theme.space(4),
        gap: theme.space(3),
        borderRadius: theme.radius['3xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    glow: {
        position: 'absolute',
        top: -80,
        right: -60,
        height: 240,
        width: 240,
        borderRadius: 120,
    },
    heroRow: {
        alignItems: 'center',
        gap: theme.space(4),
    },
    markRing: {
        height: 76,
        width: 76,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mark: {
        position: 'absolute',
    },
    heroText: {
        flex: 1,
        gap: theme.space(1),
    },
    greeting: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    body: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    allowance: {
        alignItems: 'center',
        gap: theme.space(2),
        paddingTop: theme.space(3),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    allowanceText: {
        ...theme.fontSize.sm,
        flex: 1,
        color: theme.colors.typography,
    },
    section: {
        gap: theme.space(3),
    },
    sectionRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 20,
        lineHeight: 25,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    link: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    builds: {
        gap: theme.space(3),
    },
    build: {
        flex: 1,
        minHeight: 168,
        justifyContent: 'space-between',
    },
    glyph: (color: string) => ({
        height: 40,
        width: 40,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    buildTitle: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    cost: (color: string) => ({
        ...theme.typography.eyebrow,
        color,
    }),
    list: {
        paddingVertical: theme.space(1),
        gap: 0,
    },
    line: {
        minHeight: 56,
        alignItems: 'center',
        gap: theme.space(3),
    },
    lineDivider: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    lineIcon: {
        height: 32,
        width: 32,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.elevated,
    },
    lineText: {
        flex: 1,
        gap: 2,
    },
    lineTitle: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    lineMeta: (color: string) => ({
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color,
    }),
    hint: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
        paddingHorizontal: theme.space(1),
    },
}));

/** The greeting, and the month's plan builds as a ring around Syn's mark. */
const Hero: FC = () => {
    const { t, i18n } = useTranslation('screens');
    const { theme } = useUnistyles();
    const { user } = useUser();
    const quota = useAiQuota();
    const allowance = t('quota.left', { count: quota.remaining, limit: quota.limit });

    return (
        <VStack style={styles.tile}>
            <LinearGradient
                colors={theme.gradients.glow as [string, string]}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0, y: 1 }}
                style={styles.glow}
                pointerEvents="none"
            />
            <HStack style={styles.heroRow}>
                <Box style={styles.markRing}>
                    <Ring
                        progress={quota.limit > 0 ? quota.remaining / quota.limit : 0}
                        color={theme.colors.brand[500]}
                        size={76}
                    />
                    <Box style={styles.mark}>
                        <SynMark size={36} />
                    </Box>
                </Box>
                <VStack style={styles.heroText}>
                    <Text style={styles.greeting} numberOfLines={1}>
                        {user?.displayName
                            ? t('syn.intro.greeting', { name: user.displayName.split(' ')[0] })
                            : t('syn.intro.greetingFallback')}
                    </Text>
                    <Text style={styles.body}>{t('syn.coach.intro')}</Text>
                </VStack>
            </HStack>
            <Pressable
                onPress={() => router.navigate('/quota' as never)}
                accessibilityRole="button"
                accessibilityLabel={allowance}
            >
                <HStack style={styles.allowance}>
                    <Icon name="sparkles" size={16} color={theme.colors.primary} />
                    <Text style={styles.allowanceText} numberOfLines={1}>
                        {allowance}
                    </Text>
                    <Text style={styles.body}>
                        {t('syn.hub.resets', {
                            date: dayjs(quota.resetsOn).locale(i18n.language).format('D MMM'),
                        })}
                    </Text>
                    <Icon name="chevron-right" size={14} color={theme.colors.mutedTypography} />
                </HStack>
            </Pressable>
        </VStack>
    );
};

const Build: FC<{ kind: 'workout' | 'nutrition'; icon: IconName; color: string }> = ({
    kind,
    icon,
    color,
}) => {
    const { t } = useTranslation('screens');
    const title = t(`syn.actions.${kind}`);

    return (
        <Pressable
            style={[styles.tile, styles.build]}
            onPress={() =>
                router.navigate(
                    (kind === 'workout'
                        ? '/coach/build'
                        : { pathname: '/coach/new', params: { kind } }) as never,
                )
            }
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={t('coach.hub.hint')}
        >
            <Box style={styles.glyph(color)}>
                <Icon name={icon} size={19} color={color} />
            </Box>
            <VStack style={styles.lineText}>
                <Text style={styles.buildTitle}>{title}</Text>
                <Text style={styles.body} numberOfLines={3}>
                    {t(`syn.actions.${kind}Hint`)}
                </Text>
            </VStack>
            <Text style={styles.cost(color)}>{t('coach.hub.cost')}</Text>
        </Pressable>
    );
};

const PlanLine: FC<{ plan: AiPlanSelect; first: boolean }> = ({ plan, first }) => {
    const { t, i18n } = useTranslation('screens');
    const { theme } = useUnistyles();
    const status = planStatus(plan);
    const meta = [
        t(`coach.plans.status.${status}`),
        plan.status === 'applied'
            ? planRange(plan, i18n.language)
            : dayjs(plan.createdAt).locale(i18n.language).format('D MMM'),
    ].join(' · ');

    return (
        <Pressable
            onPress={() => router.navigate(`/coach/plan/${plan.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`${plan.payload.title}, ${meta}`}
        >
            <HStack style={[styles.line, !first && styles.lineDivider]}>
                <Box style={styles.lineIcon}>
                    <Icon
                        name={plan.kind === 'nutrition' ? 'utensils' : 'dumbbell'}
                        size={15}
                        color={theme.colors.typography}
                    />
                </Box>
                <VStack style={styles.lineText}>
                    <Text style={styles.lineTitle} numberOfLines={1}>
                        {plan.payload.title}
                    </Text>
                    <Text
                        style={styles.lineMeta(
                            status === 'active'
                                ? (theme.colors.success as string)
                                : (theme.colors.mutedTypography as string),
                        )}
                        numberOfLines={1}
                    >
                        {meta}
                    </Text>
                </VStack>
                <Icon name="chevron-right" size={14} color={theme.colors.mutedTypography} />
            </HStack>
        </Pressable>
    );
};

export const CoachHub: FC<{ questions: Question[] }> = ({ questions }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const { plans } = usePlans();

    return (
        <VStack style={styles.container}>
            <Hero />

            <VStack style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                    {t('syn.hub.build')}
                </Text>
                <HStack style={styles.builds}>
                    <Build kind="workout" icon="dumbbell" color={ACCENT.sessions} />
                    <Build kind="nutrition" icon="utensils" color={ACCENT.distance} />
                </HStack>
            </VStack>

            <VStack style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                    {t('coach.hub.ask')}
                </Text>
                <VStack style={[styles.tile, styles.list]}>
                    {questions.map((question, index) => (
                        <Pressable
                            key={question.key}
                            onPress={question.run}
                            accessibilityRole="button"
                        >
                            <HStack style={[styles.line, index > 0 && styles.lineDivider]}>
                                <Box style={styles.lineIcon}>
                                    <Icon
                                        name={question.icon}
                                        size={15}
                                        color={theme.colors.typography}
                                    />
                                </Box>
                                <Text style={[styles.lineTitle, styles.lineText]}>
                                    {question.label}
                                </Text>
                                <Icon name="arrow-up" size={16} color={theme.colors.primary} />
                            </HStack>
                        </Pressable>
                    ))}
                </VStack>
                <Text style={styles.hint}>{t('coach.hub.askHint')}</Text>
            </VStack>

            {plans.length > 0 ? (
                <VStack style={styles.section}>
                    <HStack style={styles.sectionRow}>
                        <Text style={styles.sectionTitle} accessibilityRole="header">
                            {t('coach.plans.title')}
                        </Text>
                        <Pressable
                            onPress={() => router.navigate('/coach/plans' as never)}
                            accessibilityRole="button"
                            hitSlop={8}
                        >
                            <Text style={styles.link}>{t('coach.hub.seeAll')}</Text>
                        </Pressable>
                    </HStack>
                    <VStack style={[styles.tile, styles.list]}>
                        {plans.slice(0, RECENT_PLANS).map((plan, index) => (
                            <PlanLine key={plan.id} plan={plan} first={index === 0} />
                        ))}
                    </VStack>
                </VStack>
            ) : null}
        </VStack>
    );
};

/** The hub's shape while the conversation loads. */
export const CoachHubSkeleton: FC = () => (
    <VStack style={styles.container}>
        <Skeleton height={164} radius={22} />
        <VStack style={styles.section}>
            <Skeleton width={90} height={22} />
            <HStack style={styles.builds}>
                <Skeleton height={168} radius={22} style={styles.build} />
                <Skeleton height={168} radius={22} style={styles.build} />
            </HStack>
        </VStack>
        <Skeleton height={176} radius={22} />
    </VStack>
);
