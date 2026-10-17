import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import CalorieGoalScreen from '@/screens/calories/goal';

const Route = () => {
    useAnalyticsScreen('calorie_goal');

    return <CalorieGoalScreen />;
};

export default Route;
