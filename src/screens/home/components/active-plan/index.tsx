import { FC, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Flame } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { useActivePlan, useSynActions } from '@/hooks/use-ai';
import { derivePlanProgress } from '@/helpers/ai-plan';
import type { AiPlanKind } from '@/constants/ai';
import type { WorkoutSelect } from '@/db/schema';

/**
 * What the user is currently training on, and how far through it they are.
 *
 * Everything on this card is derived rather than stored — see
 * `derivePlanProgress`, which is where the week arithmetic and its edges live.
 *
 * The three revision presets are the honest version of what the reference design
 * calls "Enhance with AI". Nothing in this app edits a plan in place: every
 * generation writes a *new* plan, and applying it replaces the schedule. So they
 * are labelled as a rewrite and they confirm first, because each one spends one
 * of three generations a month and a mis-tap is a third of the allowance.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(5),
        gap: theme.space(3),
    },
    topRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    eyebrow: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    week: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    cadence: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    progressTrack: {
        height: theme.space(1.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
        overflow: 'hidden',
    },
    progressFill: (ratio: number) => ({
        width: `${Math.round(ratio * 100)}%`,
        height: '100%',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
    }),
    metaRow: {
        alignItems: 'center',
        gap: theme.space(4),
    },
    meta: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    streak: {
        alignItems: 'center',
        gap: theme.space(1),
    },
    reviseLabel: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
        marginTop: theme.space(1),
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
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1.5),
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

interface ActivePlanCardProps {
    /** Already loaded by Home; the completed count is read from these. */
    workouts: WorkoutSelect[];
    streak: number;
}

const REVISIONS: { key: string; kind: AiPlanKind }[] = [
    { key: 'harder', kind: 'workout' },
    { key: 'swap', kind: 'workout' },
    { key: 'nutrition', kind: 'combined' },
];

export const ActivePlanCard: FC<ActivePlanCardProps> = ({ workouts, streak }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { activePlan } = useActivePlan();
    const { generate, exhausted, isGenerating } = useSynActions();

    const progress = useMemo(
        () => (activePlan ? derivePlanProgress(activePlan, workouts) : null),
        [activePlan, workouts],
    );

    const revise = useCallback(
        (kind: AiPlanKind, key: string) => {
            // Spending a generation is not undoable, and the result replaces the
            // plan rather than amending it. Both facts belong in front of the tap.
            Alert.alert(
                t('home.plan.revise.confirmTitle', { ns: 'screens' }),
                t('home.plan.revise.confirmBody', { ns: 'screens' }),
                [
                    { text: t('syn.plan.cancel', { ns: 'screens' }), style: 'cancel' },
                    {
                        text: t('home.plan.revise.confirm', { ns: 'screens' }),
                        onPress: () => {
                            if (
                                generate(
                                    kind,
                                    t(`home.plan.revise.${key}Intent`, { ns: 'screens' }),
                                )
                            ) {
                                router.navigate('/syn');
                            }
                        },
                    },
                ],
            );
        },
        [generate, t],
    );

    if (!activePlan || !progress) return null;

    const ratio = progress.sessionsTotal === 0 ? 0 : progress.sessionsDone / progress.sessionsTotal;

    return (
        <VStack style={styles.container}>
            <HStack style={styles.topRow}>
                <Text style={styles.eyebrow}>{t('home.plan.eyebrow', { ns: 'screens' })}</Text>
                <Text style={styles.week}>
                    {t('home.plan.week', {
                        ns: 'screens',
                        week: progress.week,
                        weeks: progress.weeks,
                    })}
                </Text>
            </HStack>

            <VStack>
                <Title type="h5" numberOfLines={2}>
                    {progress.title}
                </Title>
                {progress.perWeek > 0 ? (
                    <Text style={styles.cadence}>
                        {t('home.plan.cadence', { ns: 'screens', count: progress.perWeek })}
                    </Text>
                ) : null}
            </VStack>

            <Box style={styles.progressTrack}>
                <Box style={styles.progressFill(ratio)} />
            </Box>

            <HStack style={styles.metaRow}>
                <Text style={styles.meta}>
                    {t('home.plan.sessions', {
                        ns: 'screens',
                        done: progress.sessionsDone,
                        total: progress.sessionsTotal,
                    })}
                </Text>

                {streak > 0 ? (
                    <HStack style={styles.streak}>
                        <Flame
                            size={theme.space(3.5)}
                            strokeWidth={2}
                            color={theme.colors.primary}
                            fill={theme.colors.primary}
                        />
                        <Text style={styles.meta}>
                            {t('home.streak', { ns: 'screens', count: streak })}
                        </Text>
                    </HStack>
                ) : null}
            </HStack>

            <Text style={styles.reviseLabel}>{t('home.plan.revise.label', { ns: 'screens' })}</Text>

            <HStack style={styles.chips}>
                {REVISIONS.map((revision) => (
                    <Pressable
                        key={revision.key}
                        style={[styles.chip, (exhausted || isGenerating) && styles.chipDisabled]}
                        disabled={exhausted || isGenerating}
                        onPress={() => revise(revision.kind, revision.key)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.chipLabel}>
                            {t(`home.plan.revise.${revision.key}`, { ns: 'screens' })}
                        </Text>
                    </Pressable>
                ))}
            </HStack>
        </VStack>
    );
};
