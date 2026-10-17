import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SessionDetailScreen from '@/screens/sessions/detail';

const Route = () => {
    useAnalyticsScreen('session');

    return <SessionDetailScreen />;
};

export default Route;
