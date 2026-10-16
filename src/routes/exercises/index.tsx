import { useEffect } from 'react';
import { Redirect } from 'expo-router';

import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { usePlanSegmentStore } from '@/stores/plan-segment';

/** The library used to be a tab at /exercises; it is now Plan's Library segment. */
export default function ExercisesRedirect() {
    useAnalyticsScreen('exercise_library');

    const setSegment = usePlanSegmentStore((state) => state.setSegment);

    useEffect(() => setSegment('library'), [setSegment]);

    return <Redirect href="/workouts" />;
}
