import { TabSwipe } from '@/components/layout/tab-swipe';
import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SettingsScreen from '@/screens/settings/settings';

const YouRoute = () => {
    useAnalyticsScreen('you');

    return (
        <TabSwipe index={3}>
            <SettingsScreen />
        </TabSwipe>
    );
};

export default YouRoute;
