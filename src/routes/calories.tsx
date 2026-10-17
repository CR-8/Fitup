import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import CaloriesScreen from '@/screens/calories';

const Route = () => {
    useAnalyticsScreen('calories');

    return <CaloriesScreen />;
};

export default Route;
