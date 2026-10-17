import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import CalendarScreen from '@/screens/calories/calendar';

const Route = () => {
    useAnalyticsScreen('calendar');

    return <CalendarScreen />;
};

export default Route;
