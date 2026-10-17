import { Redirect } from 'expo-router';

import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';

/** The old /exercises link. Its home, Plan, is off the navigation, so it lands on Today. */
export default function ExercisesRedirect() {
    useAnalyticsScreen('exercise_library');

    return <Redirect href="/" />;
}
