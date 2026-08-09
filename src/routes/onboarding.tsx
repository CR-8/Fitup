import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { OnboardingScreen } from '@/screens';

const Onboarding = () => {
    useAnalyticsScreen('onboarding');

    return <OnboardingScreen />;
};

export default Onboarding;
