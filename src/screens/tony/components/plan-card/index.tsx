import { FC, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Separator } from '@/components/layout/separator';
import type { AiPlanSelect } from '@/db/schema';
import { useApplyAiPlan } from '@/hooks/use-ai';
import type { AiPlanMeal, AiPlanWorkout } from '@/types/ai';

const styles = StyleSheet.create((theme, rt) => ({
    // Mirrors the rounded panel used across settings, results, and workout cards.
    container: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(3),
    },
    header: {
        gap: theme.space(1),
    },
    headerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    section: {
        gap: theme.space(3),
    },
    day: {
        gap: theme.space(1.5),
    },
    dayLabel: {
        color: theme.colors.neutral[400],
    },
    itemRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    itemName: {
        flex: 1,
    },
    macroRow: {
        gap: theme.space(3),
        flexWrap: 'wrap',
    },
    toggle: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(1),
    },
    appliedButton: {
        backgroundColor: theme.colors.foreground,
    },
    appliedButtonText: {
        color: theme.colors.typography,
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

    return (
        <VStack style={styles.day}>
            <Text fontSize="xs" fontWeight="semibold" style={styles.dayLabel}>
                {t('tony.plan.day', { number: dayOffset + 1 })}
            </Text>

            {workouts.map((workout, workoutIndex) => (
                <VStack key={`${workout.name}-${workoutIndex}`} style={styles.day}>
                    <Text fontSize="sm" fontWeight="semibold">
                        {workout.name}
                    </Text>

                    {workout.exercises.map((exercise, exerciseIndex) => (
                        <HStack
                            key={`${exercise.exerciseId}-${exerciseIndex}`}
                            style={styles.itemRow}
                        >
                            <Text fontSize="sm" style={styles.itemName} numberOfLines={1}>
                                {exercise.name}
                            </Text>
                            <Text fontSize="xs" style={styles.muted}>
                                {exercise.reps
                                    ? t('tony.plan.setsReps', {
                                          sets: exercise.sets,
                                          reps: exercise.reps,
                                      })
                                    : t('tony.plan.sets', { sets: exercise.sets })}
                            </Text>
                        </HStack>
                    ))}
                </VStack>
            ))}
        </VStack>
    );
};

const MealDay: FC<{ dayOffset: number; meals: AiPlanMeal[] }> = ({ dayOffset, meals }) => {
    const { t } = useTranslation('screens');

    return (
        <VStack style={styles.day}>
            <Text fontSize="xs" fontWeight="semibold" style={styles.dayLabel}>
                {t('tony.plan.day', { number: dayOffset + 1 })}
            </Text>

            {meals.map((meal, mealIndex) => (
                <VStack key={`${meal.slot}-${mealIndex}`} style={styles.day}>
                    <Text fontSize="sm" fontWeight="semibold">
                        {t(`tony.plan.slots.${meal.slot}`)}
                    </Text>

                    {meal.items.map((item, itemIndex) => (
                        <HStack key={`${item.name}-${itemIndex}`} style={styles.itemRow}>
                            <Text fontSize="sm" style={styles.itemName} numberOfLines={2}>
                                {item.quantity ? `${item.name} · ${item.quantity}` : item.name}
                            </Text>
                            {item.calories ? (
                                <Text fontSize="xs" style={styles.muted}>
                                    {t('tony.plan.kcal', { value: Math.round(item.calories) })}
                                </Text>
                            ) : null}
                        </HStack>
                    ))}
                </VStack>
            ))}
        </VStack>
    );
};

export const PlanCard: FC<PlanCardProps> = ({ plan }) => {
    const { t } = useTranslation('screens');
    const { theme, rt } = useUnistyles();
    const [expanded, setExpanded] = useState(false);
    const { apply, revert, isApplying, isReverting } = useApplyAiPlan();

    const payload = plan.payload;
    const isApplied = plan.status === 'applied';

    const workoutDays = useMemo(() => groupByDay(payload.workouts), [payload.workouts]);
    const mealDays = useMemo(() => groupByDay(payload.meals), [payload.meals]);

    // Collapsed shows the first two days so a long plan does not swamp the thread.
    const visibleWorkoutDays = expanded ? workoutDays : workoutDays.slice(0, 2);
    const visibleMealDays = expanded ? mealDays : mealDays.slice(0, 2);
    const hiddenDays =
        workoutDays.length + mealDays.length - visibleWorkoutDays.length - visibleMealDays.length;

    const targets = payload.targets[0];

    const handleApply = () => {
        Alert.alert(t('tony.plan.applyTitle'), t('tony.plan.applyMessage'), [
            { text: t('tony.plan.cancel'), style: 'cancel' },
            {
                text: t('tony.plan.applyConfirm'),
                onPress: () => {
                    apply(plan).catch(() => Alert.alert(t('tony.plan.applyFailed')));
                },
            },
        ]);
    };

    const handleRevert = () => {
        Alert.alert(t('tony.plan.revertTitle'), t('tony.plan.revertMessage'), [
            { text: t('tony.plan.cancel'), style: 'cancel' },
            {
                text: t('tony.plan.revertConfirm'),
                style: 'destructive',
                onPress: () => {
                    revert(plan).catch(() => Alert.alert(t('tony.plan.revertFailed')));
                },
            },
        ]);
    };

    return (
        <VStack style={styles.container}>
            <VStack style={styles.header}>
                <HStack style={styles.headerRow}>
                    <Title type="h6">{payload.title}</Title>
                    {isApplied ? (
                        <Text fontSize="2xs" fontWeight="bold" style={styles.muted}>
                            {t('tony.plan.applied')}
                        </Text>
                    ) : null}
                </HStack>

                {payload.summary ? (
                    <Text fontSize="sm" style={styles.muted}>
                        {payload.summary}
                    </Text>
                ) : null}
            </VStack>

            {targets?.calories ? (
                <HStack style={styles.macroRow}>
                    <Text fontSize="xs" style={styles.muted}>
                        {t('tony.plan.kcal', { value: Math.round(targets.calories) })}
                    </Text>
                    {targets.proteinG ? (
                        <Text fontSize="xs" style={styles.muted}>
                            {t('tony.plan.protein', { value: Math.round(targets.proteinG) })}
                        </Text>
                    ) : null}
                    {targets.carbsG ? (
                        <Text fontSize="xs" style={styles.muted}>
                            {t('tony.plan.carbs', { value: Math.round(targets.carbsG) })}
                        </Text>
                    ) : null}
                    {targets.fatG ? (
                        <Text fontSize="xs" style={styles.muted}>
                            {t('tony.plan.fat', { value: Math.round(targets.fatG) })}
                        </Text>
                    ) : null}
                </HStack>
            ) : null}

            <Separator />

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
                        <Text fontSize="xs" style={styles.muted}>
                            {expanded ? t('tony.plan.showLess') : t('tony.plan.showMore')}
                        </Text>
                        {expanded ? (
                            <ChevronUp size={theme.space(3.5)} color={theme.colors.neutral[400]} />
                        ) : (
                            <ChevronDown
                                size={theme.space(3.5)}
                                color={theme.colors.neutral[400]}
                            />
                        )}
                    </HStack>
                </Pressable>
            ) : null}

            {payload.workouts.length > 0 ? (
                <Box>
                    {isApplied ? (
                        <Button
                            size="sm"
                            title={t('tony.plan.undo')}
                            loading={isReverting}
                            onPress={handleRevert}
                            containerStyle={styles.appliedButton}
                            textStyle={styles.appliedButtonText}
                            spinnerColor={theme.colors.typography}
                        />
                    ) : (
                        <Button
                            size="sm"
                            title={t('tony.plan.addToSchedule')}
                            loading={isApplying}
                            onPress={handleApply}
                            spinnerColor={
                                rt.themeName === 'dark'
                                    ? theme.colors.neutral[950]
                                    : theme.colors.neutral[50]
                            }
                        />
                    )}
                </Box>
            ) : null}
        </VStack>
    );
};
