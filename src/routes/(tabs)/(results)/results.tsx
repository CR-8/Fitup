import { TabSwipe } from '@/components/layout/tab-swipe';
import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import ResultsScreen from '@/screens/results/results';

const ResultsRoute = () => {
    useAnalyticsScreen('progress');

    return (
        <TabSwipe index={2}>
            <ResultsScreen />
        </TabSwipe>
    );
};

export default ResultsRoute;
