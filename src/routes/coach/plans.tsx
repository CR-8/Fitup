import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import PlansScreen from '@/screens/coach/plans';

const Plans = () => {
    useAnalyticsScreen('coach_plans');

    return <PlansScreen />;
};

export default Plans;
