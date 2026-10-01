import { useLocalSearchParams } from 'expo-router';

import { ActionsMenu } from '@/components/buttons/actions';
import { useExerciseMenu } from '@/hooks/use-action-menus';

const useExerciseScreen = () => {
    const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
    const menu = useExerciseMenu(exerciseId ?? '');

    return {
        options: {
            title: '',
            headerRight: () => <ActionsMenu {...menu} />,
        },
    };
};

export { useExerciseScreen };
