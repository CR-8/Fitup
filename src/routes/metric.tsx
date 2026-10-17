import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import MetricScreen from '@/screens/metric';

const Route = () => {
    useAnalyticsScreen('metric');

    return <MetricScreen />;
};

export default Route;
