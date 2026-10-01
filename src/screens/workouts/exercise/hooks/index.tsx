import { router, useLocalSearchParams } from 'expo-router';

import { ActionsMenu } from '@/components/buttons/actions';
import { HeaderButton } from '@/components/buttons/header';
import { useWorkoutExerciseMenu } from '@/hooks/use-action-menus';

/** The exercise being logged; the root stack presents it as a sheet over its workout. */
const useWorkoutExerciseScreen = () => {
    const { workoutId, workoutExerciseId } = useLocalSearchParams<{
        workoutId: string;
        workoutExerciseId: string;
    }>();
    const menu = useWorkoutExerciseMenu(workoutId ?? '', workoutExerciseId ?? '');

    return {
        options: {
            title: '',
            headerLeft: () => <HeaderButton icon="chevron-down" onPress={() => router.back()} />,
            headerRight: () => <ActionsMenu {...menu} />,
        },
    };
};

export { useWorkoutExerciseScreen };
