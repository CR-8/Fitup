import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from './use-user';
import { useAnalytics } from './use-analytics';
import {
    getFilteredExercises,
    deleteExercise,
    getExerciseLibrarySnapshot,
    mergeExercise,
    getExerciseById,
    getExerciseHistory,
    getFavoriteExerciseIds,
    getRecentlyUsedExerciseIds,
    toggleFavoriteExercise,
    updateExercise,
    type ExerciseHistoryItem,
    type ExerciseFilterParams,
} from '@/crud/exercise';
import { getExerciseLibraryProperties } from '@/analytics/helpers';
import { ExerciseSelect } from '@/db/schema';
export {
    createExerciseSearchIndex,
    filterGroupedExercisesByName,
    groupExercises,
} from '@/helpers/exercise-search';
export type {
    ExerciseCard,
    ExerciseListItem,
    ExerciseSearchIndex,
} from '@/helpers/exercise-search';

export const useExercisesList = (filters?: ExerciseFilterParams) => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['exercises-list', user?.id, filters],
        queryFn: () => getFilteredExercises(user!.id, filters),
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
};

export const useDeleteExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();
    const { track } = useAnalytics();

    return useMutation({
        mutationFn: async (exerciseId: string) => {
            await deleteExercise(exerciseId, user!.id);
            return await getExerciseLibrarySnapshot(user!.id);
        },
        onSuccess: (exerciseLibrary) => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-sets'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
            queryClient.invalidateQueries({ queryKey: ['workout-groups'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
            track('exercise:delete', {
                ...getExerciseLibraryProperties(
                    exerciseLibrary?.exerciseLibraryTotalCount ?? null,
                    exerciseLibrary?.exerciseLibraryFitupCount ?? null,
                    exerciseLibrary?.exerciseLibraryUserCreatedCount ?? null,
                ),
            });
        },
    });
};

export const useExercise = (exerciseId: string) => {
    const { user } = useUser();

    return useQuery({
        queryKey: ['exercise', exerciseId, user?.id],
        queryFn: () => getExerciseById(exerciseId, user!.id),
        enabled: !!user?.id && !!exerciseId,
    });
};

export const useExerciseHistory = (exerciseId: string) => {
    const { user } = useUser();

    return useQuery<ExerciseHistoryItem[]>({
        queryKey: ['exercise-history', exerciseId, user?.id],
        queryFn: () => getExerciseHistory(exerciseId, user!.id),
        enabled: !!user?.id && !!exerciseId,
    });
};

export const useFavoriteExerciseIds = () => {
    const { user } = useUser();

    const { data } = useQuery({
        queryKey: ['exercise-favorites', user?.id],
        queryFn: () => getFavoriteExerciseIds(user!.id),
        enabled: !!user?.id,
    });

    return useMemo(() => new Set(data ?? []), [data]);
};

/**
 * Flips the heart in the cache before the write, so it answers the tap at once.
 * A heart that waits on SQLite reads as a missed press; on failure the cache is
 * simply re-read, which puts the heart back where the database says it is.
 */
export const useToggleFavoriteExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();
    const key = ['exercise-favorites', user?.id];

    return useMutation({
        mutationFn: (exerciseId: string) => toggleFavoriteExercise(user!.id, exerciseId),
        onMutate: (exerciseId) => {
            queryClient.setQueryData<string[]>(key, (ids = []) =>
                ids.includes(exerciseId)
                    ? ids.filter((id) => id !== exerciseId)
                    : [...ids, exerciseId],
            );
        },
        onError: () => queryClient.invalidateQueries({ queryKey: key }),
    });
};

export const useRecentlyUsedExerciseIds = () => {
    const { user } = useUser();

    const { data = [] } = useQuery({
        queryKey: ['exercises-recent', user?.id],
        queryFn: () => getRecentlyUsedExerciseIds(user!.id),
        enabled: !!user?.id,
    });

    return data;
};

export const useMergeExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();

    return useMutation({
        mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
            mergeExercise(sourceId, targetId, user!.id),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            queryClient.invalidateQueries({ queryKey: ['exercise'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
        },
    });
};

export const useUpdateExercise = () => {
    const queryClient = useQueryClient();
    const { user } = useUser();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<ExerciseSelect> }) =>
            updateExercise(id, user!.id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            queryClient.invalidateQueries({ queryKey: ['exercise'] });
            queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
            queryClient.invalidateQueries({ queryKey: ['workout-exercises-with-exercise'] });
        },
    });
};
