import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import AwardsScreen from '@/screens/awards';

const Route = () => {
    useAnalyticsScreen('awards');

    return <AwardsScreen />;
};

export default Route;
