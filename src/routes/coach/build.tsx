import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import BuildPlanScreen from '@/screens/coach/build';

const Route = () => {
    useAnalyticsScreen('coach_build');

    return <BuildPlanScreen />;
};

export default Route;
