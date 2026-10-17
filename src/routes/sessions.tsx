import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SessionsScreen from '@/screens/sessions';

const Route = () => {
    useAnalyticsScreen('sessions');

    return <SessionsScreen />;
};

export default Route;
