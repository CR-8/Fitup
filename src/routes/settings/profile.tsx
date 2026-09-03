import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import ProfileScreen from '@/screens/settings/profile';

const ProfileRoute = () => {
    useAnalyticsScreen('settings_profile');

    return <ProfileScreen />;
};

export default ProfileRoute;
