import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { TabSwipe } from '@/components/layout/tab-swipe';
import HomeScreen from '@/screens/home';

const HomeRoute = () => {
    useAnalyticsScreen('home');

    return (
        <TabSwipe tab="/">
            <HomeScreen />
        </TabSwipe>
    );
};

export default HomeRoute;
