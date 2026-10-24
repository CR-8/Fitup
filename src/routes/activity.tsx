import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import ActivityScreen from '@/screens/activity';

const Route = () => {
    useAnalyticsScreen('activity');

    return <ActivityScreen />;
};

export default Route;
