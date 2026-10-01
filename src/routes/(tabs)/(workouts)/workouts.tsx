import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { WorkoutHubScreen } from '@/screens';

const Workout = () => {
    useAnalyticsScreen('workout_hub');

    return <WorkoutHubScreen />;
};

export default Workout;
