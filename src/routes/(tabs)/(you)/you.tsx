import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SettingsScreen from '@/screens/settings/settings';

const YouRoute = () => {
    useAnalyticsScreen('you');

    return <SettingsScreen />;
};

export default YouRoute;
