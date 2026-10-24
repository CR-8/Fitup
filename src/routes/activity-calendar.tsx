import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import ActivityCalendarScreen from '@/screens/activity/calendar';

const Route = () => {
    useAnalyticsScreen('activity_calendar');

    return <ActivityCalendarScreen />;
};

export default Route;
