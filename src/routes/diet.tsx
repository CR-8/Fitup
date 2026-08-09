import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { DietScreen } from '@/screens';

const Diet = () => {
    useAnalyticsScreen('diet');

    return <DietScreen />;
};

export default Diet;
