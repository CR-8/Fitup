import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { PlanScreen } from '@/screens';

const Workout = () => {
    useAnalyticsScreen('plan');

    return <PlanScreen />;
};

export default Workout;
