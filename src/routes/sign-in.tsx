import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { SignInScreen } from '@/screens';

const SignIn = () => {
    useAnalyticsScreen('sign_in');

    return <SignInScreen />;
};

export default SignIn;
