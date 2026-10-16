import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { WelcomeScreen } from '@/screens';

const Welcome = () => {
    useAnalyticsScreen('welcome');

    return <WelcomeScreen />;
};

export default Welcome;
