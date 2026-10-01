import { useLocalSearchParams } from 'expo-router';

import { ActionsMenu } from '@/components/buttons/actions';
import { HeaderButton } from '@/components/buttons/header';
import { useWorkoutMenu } from '@/hooks/use-action-menus';
import { useSupersetEditStore } from '@/stores/superset-edit';

const useWorkoutScreen = () => {
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const menu = useWorkoutMenu(workoutId ?? '');

    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);
    const clearSupersetEdit = useSupersetEditStore((state) => state.clear);

    return {
        options: {
            title: '',
            // Editing supersets swaps the back button for a way out of the mode.
            headerBackVisible: !isEditMode,
            headerLeft: isEditMode
                ? () => <HeaderButton icon="x" onPress={clearSupersetEdit} />
                : undefined,
            headerRight: isEditMode ? undefined : () => <ActionsMenu {...menu} />,
        },
    };
};

export { useWorkoutScreen };
