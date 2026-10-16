import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import QuotaScreen from '@/screens/quota';

const Quota = () => {
    useAnalyticsScreen('quota');

    return <QuotaScreen />;
};

export default Quota;
