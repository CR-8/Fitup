import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import HydrationScreen from '@/screens/hydration';

const Hydration = () => {
    useAnalyticsScreen('hydration');

    return <HydrationScreen />;
};

export default Hydration;
