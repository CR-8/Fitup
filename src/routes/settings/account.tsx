import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import AccountScreen from '@/screens/settings/account';

const AccountRoute = () => {
    useAnalyticsScreen('settings_account');

    return <AccountScreen />;
};

export default AccountRoute;
