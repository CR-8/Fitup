import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SynWelcomeScreen from '@/screens/syn-welcome';

const Route = () => {
    useAnalyticsScreen('syn_welcome');

    return <SynWelcomeScreen />;
};

export default Route;
