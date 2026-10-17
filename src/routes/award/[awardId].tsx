import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import AwardScreen from '@/screens/awards/detail';

const Route = () => {
    useAnalyticsScreen('award');

    return <AwardScreen />;
};

export default Route;
