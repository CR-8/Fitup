import { useTranslation } from 'react-i18next';

import { CreateButton } from '@/components/buttons/create';
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';

/** The workouts tab owns creating one, so its `+` sits in this header. */
const useWorkoutHubTab = () => {
    const { t } = useTranslation(['screens']);
    const { navigate } = useEditor();
    const { track } = useAnalytics();

    const handleWorkoutCreate = () => {
        track('workout:create_requested', { surface: 'workout_tab_header' });
        navigate({ type: 'workout__create' });
    };

    return {
        name: 'workouts',
        options: {
            title: t('workoutHub.title'),
            headerRight: () => <CreateButton onPressHandler={handleWorkoutCreate} />,
        },
    };
};

export { useWorkoutHubTab };
