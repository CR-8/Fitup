import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { Stack } from '@/navigators/stack';
import { ExerciseScreen } from '@/screens';
import { useExerciseScreen } from '@/screens/exercises/exercise/hooks';

const ExerciseRoute = () => {
    useAnalyticsScreen('exercise_detail');

    const { options } = useExerciseScreen();

    return (
        <>
            <Stack.Screen options={options} />
            <ExerciseScreen />
        </>
    );
};

export default ExerciseRoute;
