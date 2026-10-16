import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import InboxScreen from '@/screens/inbox';

const InboxRoute = () => {
    useAnalyticsScreen('inbox');

    return <InboxScreen />;
};

export default InboxRoute;
