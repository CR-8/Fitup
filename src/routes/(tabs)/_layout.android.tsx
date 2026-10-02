import React from 'react';
import { Tabs } from 'expo-router';

import { Menu } from '@/components/overlays/menu';
import { useExercisesTab } from '@/screens/exercises/exercises/hooks';
import { useScreen } from '@/hooks/use-screen';
import { useHomeTab } from '@/screens/home/hooks';
import { useResultsTab } from '@/screens/results/results/hooks';
import { useWorkoutHubTab } from '@/screens/workouts/hub/hooks';
import { useSynTab } from '@/screens/syn/hooks';

/**
 * Android keeps the pre-native tab bar and headers. Each tab is a route group
 * (shared with iOS's native tabs), so the screens are addressed by group.
 */
export default function TabLayout() {
    const { options } = useScreen();

    const home = useHomeTab();
    const exercises = useExercisesTab();
    const workout = useWorkoutHubTab();
    const results = useResultsTab();
    const syn = useSynTab();

    return (
        <Tabs
            tabBar={(props) => <Menu {...props} />}
            screenOptions={{
                ...options,
                headerTitle: () => null,
                headerLeft: () => null,
            }}
        >
            <Tabs.Screen name="(home)" options={home.options} />
            <Tabs.Screen name="(exercises)" options={exercises.options} />
            <Tabs.Screen name="(workouts)" options={workout.options} />
            <Tabs.Screen name="(results)" options={results.options} />
            <Tabs.Screen name="(syn)" options={syn.options} />
        </Tabs>
    );
}
