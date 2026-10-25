import { TabSwipe } from '@/components/layout/tab-swipe';
import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import HomeScreen from '@/screens/home';

const HomeRoute = () => {
    useAnalyticsScreen('home');

    return (
        <TabSwipe index={0}>
            <HomeScreen />
        </TabSwipe>
    );
};

export default HomeRoute;
