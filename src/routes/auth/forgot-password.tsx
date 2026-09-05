import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { ForgotPasswordScreen } from '@/screens';

const ForgotPassword = () => {
    useAnalyticsScreen('forgot_password');

    return <ForgotPasswordScreen />;
};

export default ForgotPassword;
