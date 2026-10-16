import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import DietScreen from '@/screens/settings/diet';

const DietRoute = () => {
    // Reached from Profile and counted with it until it has a screen name of its own.
    useAnalyticsScreen('settings_profile');

    return <DietScreen />;
};

export default DietRoute;
