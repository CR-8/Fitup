import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import FeedbackScreen from '@/screens/settings/feedback';

const FeedbackRoute = () => {
    useAnalyticsScreen('settings_feedback');

    return <FeedbackScreen />;
};

export default FeedbackRoute;
