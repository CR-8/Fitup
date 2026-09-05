import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { NewPasswordScreen } from '@/screens';

const NewPassword = () => {
    useAnalyticsScreen('new_password');

    return <NewPasswordScreen />;
};

export default NewPassword;
