import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useIsMutating } from '@tanstack/react-query';

import type { MenuAction } from '@/components/buttons/actions';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useEditor } from '@/hooks/use-editor';
import {
    deleteWorkoutMutationKey,
    useCreateExerciseSet,
    useDeleteWorkout,
    useDeleteWorkoutExercise,
    useDuplicateWorkout,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { useDeleteExercise, useExercise } from '@/hooks/use-exercises';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import { isFitupExercise } from '@/crud/exercise';
import { normalizeSetType } from '@/helpers/set-type';
import { addWorkoutExerciseSet, type SetType } from '@/screens/workouts/exercise/helpers/add-set';

/**
 * The app's action menus as native menus (UIMenu / Material dropdown). Each hook
 * returns the items and the handler `ActionsMenu` needs; the bodies are the
 * ones the old action sheet ran.
 */
export type ActionMenu = { actions: MenuAction[]; onAction: (id: string) => void };

const DUPLICATE_MODES = ['now', 'planned', 'completed'] as const;
type DuplicateMode = (typeof DUPLICATE_MODES)[number];

/** Repeat (on a finished workout) or copy (from its menu) as now / planned / completed. */
export const useDuplicateMenu = (workoutId: string, labels: 'repeat' | 'copy'): ActionMenu => {
    const { t } = useTranslation(['screens']);
    const router = useRouter();
    const { runningWorkout } = useRunningWorkoutStatic();
    const duplicateWorkout = useDuplicateWorkout();

    const actions: MenuAction[] = DUPLICATE_MODES.filter(
        (mode) => !(mode === 'now' && runningWorkout),
    ).map((mode) => ({
        id: `duplicate:${mode}`,
        title: t(`workout.${labels}.${mode === 'planned' ? 'plan' : mode}`, { ns: 'screens' }),
        image: mode === 'now' ? 'play' : mode === 'planned' ? 'calendar' : 'checkmark.circle',
        attributes: { disabled: duplicateWorkout.isPending },
    }));

    const onAction = useCallback(
        async (id: string) => {
            const mode = id.replace('duplicate:', '') as DuplicateMode;
            if (!workoutId || duplicateWorkout.isPending) return;

            const result = await duplicateWorkout.mutateAsync({ workoutId, mode });
            router.setParams({ workoutId: result.workout.id });
        },
        [duplicateWorkout, router, workoutId],
    );

    return { actions, onAction };
};

export const useWorkoutMenu = (workoutId: string): ActionMenu => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();
    const { navigate } = useEditor();
    const copy = useDuplicateMenu(workoutId, 'copy');

    const deleteWorkout = useDeleteWorkout();
    const deleteWorkoutMutations = useIsMutating({ mutationKey: deleteWorkoutMutationKey });
    const startSupersetEdit = useSupersetEditStore((state) => state.start);
    const isDeletingWorkout = deleteWorkout.isPending || deleteWorkoutMutations > 0;

    const actions: MenuAction[] = [
        { id: 'edit', title: t('edit', { ns: 'common' }), image: 'pencil' },
        {
            id: 'supersets',
            title: t('workout.supersets.edit', { ns: 'screens' }),
            image: 'link',
        },
        ...copy.actions,
        {
            id: 'delete',
            title: t('delete', { ns: 'common' }),
            image: 'trash',
            attributes: { destructive: true, disabled: isDeletingWorkout },
        },
    ];

    const onAction = useCallback(
        (id: string) => {
            if (!workoutId) return;

            if (id === 'edit') navigate({ type: 'workout__edit', payload: { workoutId } });
            else if (id === 'supersets') startSupersetEdit(workoutId);
            else if (id.startsWith('duplicate:')) void copy.onAction(id);
            else if (id === 'delete' && !isDeletingWorkout) {
                Alert.alert(t('workout.deleteWorkoutAlert', { ns: 'screens' }), undefined, [
                    { text: t('cancel', { ns: 'common' }), style: 'cancel' },
                    {
                        text: t('delete', { ns: 'common' }),
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await deleteWorkout.mutateAsync(workoutId);
                                router.replace('/');
                            } catch {
                                // deleteWorkout reports the underlying error.
                            }
                        },
                    },
                ]);
            }
        },
        [copy, deleteWorkout, isDeletingWorkout, navigate, router, startSupersetEdit, t, workoutId],
    );

    return { actions, onAction };
};

export const useExerciseMenu = (exerciseId: string): ActionMenu => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();
    const { navigate } = useEditor();
    const deleteExercise = useDeleteExercise();
    const { data: exercise } = useExercise(exerciseId);

    const canDelete = exercise ? !isFitupExercise(exercise) : false;

    const actions: MenuAction[] = [
        { id: 'edit', title: t('edit', { ns: 'common' }), image: 'pencil' },
        { id: 'merge', title: t('merge', { ns: 'common' }), image: 'arrow.triangle.merge' },
        {
            id: 'delete',
            title: t('delete', { ns: 'common' }),
            image: 'trash',
            attributes: { destructive: true, hidden: !canDelete },
        },
    ];

    const onAction = useCallback(
        (id: string) => {
            if (!exerciseId) return;

            if (id === 'edit') navigate({ type: 'exercise__edit', payload: { exerciseId } });
            else if (id === 'merge')
                router.navigate({
                    pathname: '/select',
                    params: { merge: 'true', sourceExerciseId: exerciseId },
                });
            else if (id === 'delete' && canDelete) {
                Alert.alert(t('exercise.deleteExerciseAlert', { ns: 'screens' }), undefined, [
                    { text: t('cancel', { ns: 'common' }), style: 'cancel' },
                    {
                        text: t('delete', { ns: 'common' }),
                        style: 'destructive',
                        onPress: () => {
                            deleteExercise.mutate(exerciseId);
                            router.back();
                        },
                    },
                ]);
            }
        },
        [canDelete, deleteExercise, exerciseId, navigate, router, t],
    );

    return { actions, onAction };
};

const ADD_SET_TYPES: SetType[] = ['working', 'failure', 'dropset', 'warmup'];

export const useWorkoutExerciseMenu = (
    workoutId: string,
    workoutExerciseId: string,
): ActionMenu => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();
    const { data: workoutDetails } = useWorkoutWithDetails(workoutId);
    const createExerciseSet = useCreateExerciseSet();
    const deleteWorkoutExercise = useDeleteWorkoutExercise();

    const actions: MenuAction[] = [
        ...ADD_SET_TYPES.map((setType): MenuAction => ({
            id: `add:${setType}`,
            title: t(`workoutExercise.addSet.${setType}.title`, { ns: 'screens' }),
            image: 'plus',
            attributes: { disabled: !workoutDetails || createExerciseSet.isPending },
        })),
        {
            id: 'delete',
            title: t('workoutExercise.delete', { ns: 'screens' }),
            image: 'trash',
            attributes: { destructive: true, disabled: deleteWorkoutExercise.isPending },
        },
    ];

    const onAction = useCallback(
        (id: string) => {
            if (!workoutId || !workoutExerciseId) return;

            if (id.startsWith('add:')) {
                if (createExerciseSet.isPending) return;

                void addWorkoutExerciseSet({
                    workoutDetails,
                    workoutExerciseId,
                    setType: id.replace('add:', '') as SetType,
                    createSet: createExerciseSet.mutateAsync,
                });
            } else if (id === 'delete' && !deleteWorkoutExercise.isPending) {
                Alert.alert(t('workoutExercise.deleteAlert', { ns: 'screens' }), undefined, [
                    { text: t('cancel', { ns: 'common' }), style: 'cancel' },
                    {
                        text: t('delete', { ns: 'common' }),
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await deleteWorkoutExercise.mutateAsync({
                                    id: workoutExerciseId,
                                    workoutId,
                                });
                                router.back();
                            } catch {
                                // deleteWorkoutExercise reports the underlying error.
                            }
                        },
                    },
                ]);
            }
        },
        [
            createExerciseSet,
            deleteWorkoutExercise,
            router,
            t,
            workoutDetails,
            workoutExerciseId,
            workoutId,
        ],
    );

    return { actions, onAction };
};

const SET_TYPES = ['working', 'warmup', 'dropset', 'failure'] as const;

/** Picks a set's type; the current one carries the checkmark. */
export const useSetTypeMenu = (setId: string, setType: string): ActionMenu => {
    const { t } = useTranslation(['common']);
    const { mutateAsync: updateSet } = useUpdateExerciseSet();

    const actions: MenuAction[] = SET_TYPES.map((type) => ({
        id: type,
        title: t(`setType.${type}`, { ns: 'common' }),
        state: type === setType ? 'on' : 'off',
    }));

    const onAction = useCallback(
        (id: string) => {
            const nextType = normalizeSetType(id);
            if (nextType === setType) return;

            void updateSet({ id: setId, updates: { type: nextType } });
        },
        [setId, setType, updateSet],
    );

    return { actions, onAction };
};
