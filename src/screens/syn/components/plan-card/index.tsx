import { FC, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { Separator } from '@/components/layout/separator';
import type { AiPlanSelect } from '@/db/schema';
import { useApplyAiPlan } from '@/hooks/use-ai';
import { planRange, planStatus } from '@/helpers/ai-plan';
import { usePlanDiff } from '@/hooks/use-plan-diff';
import { useMergePreviewStore } from '@/stores/merge-preview';
import type { AiPlanMeal, AiPlanWorkout } from '@/types/ai';
import { Icon } from '@/components/primitives/icon';

/**
 * A generated plan, laid out as the reference's Review Plan: whether it is a
 * draft or on the schedule, its title and rationale, then each day as its own
 * group of rows (a glyph, the session or meal, what is in it), and one
 * full-width action. Nothing here changes the schedule; Preview changes does
 * that, after a row-by-row confirmation.
 */
const styles = StyleSheet.create((theme) => ({
    container: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        padding: theme.space(4),
        gap: theme.space(4),
    },
    header: {
        gap: theme.space(1),
    },
    status: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
    },
    title: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    muted: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    summaryLine: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    section: {
        gap: theme.space(3),
    },
    day: {
        borderRadius: theme.radius.xl,
        borderCurve: 'continuous',
        backgroundColor: theme.colors.elevated,
        overflow: 'hidden',
    },
    dayHeader: {
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.space(3.5),
        paddingTop: theme.space(3),
        paddingBottom: theme.space(1),
    },
    dayLabel: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    dayMeta: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    row: {
        alignItems: 'flex-start',
        gap: theme.space(3),
        paddingHorizontal: theme.space(3.5),
        paddingVertical: theme.space(2.5),
    },
    glyph: {
        height: theme.space(9),
        width: theme.space(9),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
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
    itemRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    itemName: {
        ...theme.fontSize.sm,
        flex: 1,
        color: theme.colors.mutedTypography,
    },
    itemValue: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        ...theme.typography.metric,
    },
    rowDivider: {
        marginLeft: theme.space(15.5),
    },
    macroRow: {
        gap: theme.space(3),
        flexWrap: 'wrap',
    },
    toggle: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(1),
        minHeight: 44,
    },
}));

interface PlanCardProps {
    plan: AiPlanSelect;
}

const groupByDay = <T extends { dayOffset: number }>(entries: T[]): [number, T[]][] => {
    const map = new Map<number, T[]>();

    for (const entry of entries) {
        const bucket = map.get(entry.dayOffset) ?? [];
        bucket.push(entry);
        map.set(entry.dayOffset, bucket);
    }

    return [...map.entries()].sort((a, b) => a[0] - b[0]);
};

const WorkoutDay: FC<{ dayOffset: number; workouts: AiPlanWorkout[] }> = ({
    dayOffset,
    workouts,
}) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();

    return (
        <VStack style={styles.day}>
            <HStack style={styles.dayHeader}>
                <Text style={styles.dayLabel} accessibilityRole="header">
                    {t('syn.plan.day', { number: dayOffset + 1 })}
                </Text>
                <Text style={styles.dayMeta}>
                    {t('syn.plan.sessions', { count: workouts.length })}
                </Text>
            </HStack>

            {workouts.map((workout, workoutIndex) => (
                <VStack key={`${workout.name}-${workoutIndex}`}>
                    {workoutIndex > 0 ? <Separator style={styles.rowDivider} /> : null}
                    <HStack style={styles.row}>
                        <Box style={styles.glyph}>
                            <Icon name="dumbbell" size={18} color={theme.colors.primary} />
                        </Box>
                        <VStack style={styles.rowText}>
                            <Text style={styles.rowTitle}>{workout.name}</Text>
                            {workout.exercises.map((exercise, exerciseIndex) => (
                                <HStack
                                    key={`${exercise.exerciseId}-${exerciseIndex}`}
                                    style={styles.itemRow}
                                >
                                    <Text style={styles.itemName} numberOfLines={1}>
                                        {exercise.name}
                                    </Text>
                                    <Text style={styles.itemValue}>
                                        {exercise.reps
                                            ? t('syn.plan.setsReps', {
                                                  sets: exercise.sets,
                                                  reps: exercise.reps,
                                              })
                                            : t('syn.plan.sets', { sets: exercise.sets })}
                                    </Text>
                                </HStack>
                            ))}
                        </VStack>
                    </HStack>
                </VStack>
            ))}
        </VStack>
    );
};

const MealDay: FC<{ dayOffset: number; meals: AiPlanMeal[] }> = ({ dayOffset, meals }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const calories = Math.round(
        meals.reduce(
            (sum, meal) =>
                sum + meal.items.reduce((total, item) => total + (item.calories ?? 0), 0),
            0,
        ),
    );

    return (
        <VStack style={styles.day}>
            <HStack style={styles.dayHeader}>
                <Text style={styles.dayLabel} accessibilityRole="header">
                    {t('syn.plan.day', { number: dayOffset + 1 })}
                </Text>
                {calories > 0 ? (
                    <Text style={styles.dayMeta}>{t('syn.plan.kcal', { value: calories })}</Text>
                ) : null}
            </HStack>

            {meals.map((meal, mealIndex) => (
                <VStack key={`${meal.slot}-${mealIndex}`}>
                    {mealIndex > 0 ? <Separator style={styles.rowDivider} /> : null}
                    <HStack style={styles.row}>
                        <Box style={styles.glyph}>
                            <Icon name="utensils" size={18} color={theme.colors.primary} />
                        </Box>
                        <VStack style={styles.rowText}>
                            <Text style={styles.rowTitle}>{t(`syn.plan.slots.${meal.slot}`)}</Text>
                            {meal.items.map((item, itemIndex) => (
                                <HStack key={`${item.name}-${itemIndex}`} style={styles.itemRow}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                        {item.quantity
                                            ? `${item.name} · ${item.quantity}`
                                            : item.name}
                                    </Text>
                                    {item.calories ? (
                                        <Text style={styles.itemValue}>
                                            {t('syn.plan.kcal', {
                                                value: Math.round(item.calories),
                                            })}
                                        </Text>
                                    ) : null}
                                </HStack>
                            ))}
                        </VStack>
                    </HStack>
                </VStack>
            ))}
        </VStack>
    );
};

export const PlanCard: FC<PlanCardProps> = ({ plan }) => {
    const { t, i18n } = useTranslation('screens');
    const { theme } = useUnistyles();
    const [expanded, setExpanded] = useState(false);
    const { revert, isReverting } = useApplyAiPlan();
    const openPreview = useMergePreviewStore((state) => state.open);
    const { summary } = usePlanDiff(plan);

    const payload = plan.payload;
    const isApplied = plan.status === 'applied';
    const ended = planStatus(plan) === 'ended';

    const workoutDays = useMemo(() => groupByDay(payload.workouts), [payload.workouts]);
    const mealDays = useMemo(() => groupByDay(payload.meals), [payload.meals]);

    // Collapsed shows the first two days so a long plan does not swamp the thread.
    const visibleWorkoutDays = expanded ? workoutDays : workoutDays.slice(0, 2);
    const visibleMealDays = expanded ? mealDays : mealDays.slice(0, 2);
    const hiddenDays =
        workoutDays.length + mealDays.length - visibleWorkoutDays.length - visibleMealDays.length;

    const targets = payload.targets[0];

    // "3 sessions · 2 replaced · 1 removed", leaving out what is zero.
    const summaryLine = [
        summary.sessions > 0 ? t('syn.plan.sessions', { count: summary.sessions }) : null,
        summary.replaced > 0 ? t('syn.plan.replaced', { count: summary.replaced }) : null,
        summary.removed > 0 ? t('syn.plan.removed', { count: summary.removed }) : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const handleRevert = () => {
        Alert.alert(t('syn.plan.revertTitle'), t('syn.plan.revertMessage'), [
            { text: t('syn.plan.cancel'), style: 'cancel' },
            {
                text: t('syn.plan.revertConfirm'),
                style: 'destructive',
                onPress: () => {
                    revert(plan).catch(() => Alert.alert(t('syn.plan.revertFailed')));
                },
            },
        ]);
    };

    return (
        <VStack style={styles.container}>
            <VStack style={styles.header}>
                <Text
                    style={[
                        styles.status,
                        {
                            color:
                                isApplied && !ended
                                    ? theme.colors.success
                                    : plan.status === 'discarded'
                                      ? theme.colors.mutedTypography
                                      : theme.colors.primary,
                        },
                    ]}
                >
                    {isApplied
                        ? `${t(ended ? 'coach.plans.status.ended' : 'syn.plan.applied')} · ${planRange(plan, i18n.language)}`
                        : t(
                              plan.status === 'discarded'
                                  ? 'coach.plans.status.archived'
                                  : 'coach.plans.status.draft',
                          )}
                </Text>
                <Text style={styles.title} accessibilityRole="header">
                    {payload.title}
                </Text>

                {payload.summary ? <Text style={styles.muted}>{payload.summary}</Text> : null}
            </VStack>

            {!isApplied && summaryLine ? (
                <Text style={styles.summaryLine}>{summaryLine}</Text>
            ) : null}

            {targets?.calories ? (
                <HStack style={styles.macroRow}>
                    <Text style={styles.muted}>
                        {t('syn.plan.kcal', { value: Math.round(targets.calories) })}
                    </Text>
                    {targets.proteinG ? (
                        <Text style={styles.muted}>
                            {t('syn.plan.protein', { value: Math.round(targets.proteinG) })}
                        </Text>
                    ) : null}
                    {targets.carbsG ? (
                        <Text style={styles.muted}>
                            {t('syn.plan.carbs', { value: Math.round(targets.carbsG) })}
                        </Text>
                    ) : null}
                    {targets.fatG ? (
                        <Text style={styles.muted}>
                            {t('syn.plan.fat', { value: Math.round(targets.fatG) })}
                        </Text>
                    ) : null}
                </HStack>
            ) : null}

            <VStack style={styles.section}>
                {visibleWorkoutDays.map(([dayOffset, workouts]) => (
                    <WorkoutDay key={`w-${dayOffset}`} dayOffset={dayOffset} workouts={workouts} />
                ))}
                {visibleMealDays.map(([dayOffset, meals]) => (
                    <MealDay key={`m-${dayOffset}`} dayOffset={dayOffset} meals={meals} />
                ))}
            </VStack>

            {hiddenDays > 0 || expanded ? (
                <Pressable onPress={() => setExpanded((value) => !value)}>
                    <HStack style={styles.toggle}>
                        <Text style={styles.muted}>
                            {expanded ? t('syn.plan.showLess') : t('syn.plan.showMore')}
                        </Text>
                        {expanded ? (
                            <Icon
                                name="chevron-up"
                                size={theme.space(3.5)}
                                color={Platform.select({
                                    ios: theme.colors.mutedTypography,
                                    default: theme.colors.neutral[400],
                                })}
                            />
                        ) : (
                            <Icon
                                name="chevron-down"
                                size={theme.space(3.5)}
                                color={Platform.select({
                                    ios: theme.colors.mutedTypography,
                                    default: theme.colors.neutral[400],
                                })}
                            />
                        )}
                    </HStack>
                </Pressable>
            ) : null}

            {payload.workouts.length > 0 || payload.meals.length > 0 ? (
                <Box>
                    {isApplied ? (
                        <Button
                            type="outline"
                            title={t('syn.plan.undo')}
                            loading={isReverting}
                            onPress={handleRevert}
                            spinnerColor={theme.solid.typography}
                        />
                    ) : (
                        <Button
                            type="primary"
                            title={t('syn.plan.previewChanges')}
                            onPress={() => openPreview(plan.id)}
                        />
                    )}
                </Box>
            ) : null}
        </VStack>
    );
};
