import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    createMealItems,
    type CreateMealItemInput,
    deleteMeal,
    deleteMealItem,
    getMealsForDate,
    getOrCreateMeal,
    type MealWithItems,
    setMealItemConsumed,
    sumConsumed,
    sumPlanned,
    toDateKey,
} from '@/crud/nutrition';
import type { MealSlot } from '@/db/schema';

import { useUser } from './use-user';
import { useAiProfile } from './use-ai';

const MEALS_KEY = 'nutrition-meals';

export const useMealsForDate = (date: string) => {
    const { user } = useUser();

    const { data = [], isLoading } = useQuery({
        queryKey: [MEALS_KEY, user?.id, date],
        queryFn: () => getMealsForDate(user!.id, date),
        enabled: !!user?.id,
        placeholderData: [],
    });

    return { meals: data as MealWithItems[], isLoading };
};

export interface DayProgress {
    consumed: ReturnType<typeof sumConsumed>;
    planned: ReturnType<typeof sumPlanned>;
    targets: {
        calories: number | null;
        proteinG: number | null;
        carbsG: number | null;
        fatG: number | null;
    };
}

/**
 * Daily totals against the user's targets.
 *
 * Consumed and planned are tracked separately: a generated plan populates the day
 * with what to eat, and only ticking an item off counts it as eaten. Conflating
 * the two would show a full day's intake before the user had eaten anything.
 */
export const useDayProgress = (meals: MealWithItems[]): DayProgress => {
    const { profile } = useAiProfile();

    return useMemo(
        () => ({
            consumed: sumConsumed(meals),
            planned: sumPlanned(meals),
            targets: {
                calories: profile?.dailyCalorieTarget ?? null,
                proteinG: profile?.dailyProteinTargetG ?? null,
                carbsG: profile?.dailyCarbsTargetG ?? null,
                fatG: profile?.dailyFatTargetG ?? null,
            },
        }),
        [meals, profile],
    );
};

const useInvalidateMeals = () => {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: [MEALS_KEY] });
};

export const useToggleMealItem = () => {
    const invalidate = useInvalidateMeals();

    return useMutation({
        mutationFn: ({ id, consumed }: { id: string; consumed: boolean }) =>
            setMealItemConsumed(id, consumed),
        onSuccess: invalidate,
    });
};

export const useDeleteMealItem = () => {
    const invalidate = useInvalidateMeals();

    return useMutation({
        mutationFn: (id: string) => deleteMealItem(id),
        onSuccess: invalidate,
    });
};

export const useDeleteMeal = () => {
    const invalidate = useInvalidateMeals();

    return useMutation({
        mutationFn: (id: string) => deleteMeal(id),
        onSuccess: invalidate,
    });
};

export const useAddMealItem = () => {
    const { user } = useUser();
    const invalidate = useInvalidateMeals();

    return useMutation({
        mutationFn: async ({
            date,
            slot,
            item,
        }: {
            date: string;
            slot: MealSlot;
            item: Omit<CreateMealItemInput, 'mealId'>;
        }) => {
            if (!user?.id) return;

            const meal = await getOrCreateMeal({ userId: user.id, date, slot });

            // Hand-entered food is logged as eaten: the user is recording what they
            // had, not planning it.
            await createMealItems([{ ...item, mealId: meal.id, consumedAt: new Date() }]);
        },
        onSuccess: invalidate,
    });
};

export { toDateKey };
