import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { AuthCallbackScreen } from '@/screens';

const AuthCallback = () => {
    useAnalyticsScreen('auth_callback');

    return <AuthCallbackScreen />;
};

export default AuthCallback;
