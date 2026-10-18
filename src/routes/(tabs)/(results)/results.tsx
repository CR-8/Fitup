import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { TabSwipe } from '@/components/layout/tab-swipe';
import ResultsScreen from '@/screens/results/results';

const ResultsRoute = () => {
    useAnalyticsScreen('progress');

    return (
        <TabSwipe tab="/results">
            <ResultsScreen />
        </TabSwipe>
    );
};

export default ResultsRoute;
