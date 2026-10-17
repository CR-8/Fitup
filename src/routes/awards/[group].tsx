import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import AwardListScreen from '@/screens/awards/list';

const Route = () => {
    useAnalyticsScreen('award_list');

    return <AwardListScreen />;
};

export default Route;
