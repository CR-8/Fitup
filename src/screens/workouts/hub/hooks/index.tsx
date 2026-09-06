import { CreateButton } from '@/components/buttons/create';
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';
import { useScreen } from '@/hooks/use-screen';

/**
 * Mirrors `useHomeTab`: a transparent header carrying the create action, so the
 * `+` that used to live on Home sits on the screen that owns workouts.
 */
const useWorkoutHubTab = () => {
    const { options } = useScreen();
    const { navigate } = useEditor();
    const { track } = useAnalytics();

    const handleWorkoutCreate = () => {
        track('workout:create_requested', { surface: 'workout_tab_header' });
        navigate({ type: 'workout__create' });
    };

    return {
        name: 'workouts',
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerRight: () => <CreateButton onPressHandler={handleWorkoutCreate} />,
        },
    };
};

export { useWorkoutHubTab };
