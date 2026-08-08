import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { TonyScreen } from '@/screens';

const Tony = () => {
    useAnalyticsScreen('tony');

    return <TonyScreen />;
};

export default Tony;
