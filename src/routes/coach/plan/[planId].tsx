import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import PlanScreen from '@/screens/coach/plan';

const Plan = () => {
    useAnalyticsScreen('coach_plan');

    return <PlanScreen />;
};

export default Plan;
