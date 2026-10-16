import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import NewPlanScreen from '@/screens/coach/new';

const NewPlan = () => {
    useAnalyticsScreen('coach_new_plan');

    return <NewPlanScreen />;
};

export default NewPlan;
