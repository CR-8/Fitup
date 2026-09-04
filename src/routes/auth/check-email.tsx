import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { CheckEmailScreen } from '@/screens';

const CheckEmail = () => {
    useAnalyticsScreen('check_email');

    return <CheckEmailScreen />;
};

export default CheckEmail;
