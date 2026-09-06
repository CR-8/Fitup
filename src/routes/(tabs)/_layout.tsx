import React from 'react';
import { Tabs } from 'expo-router';

import { Menu } from '@/components/overlays/menu';
import { useExercisesTab } from '@/screens/exercises/exercises/hooks';
import { useScreen } from '@/hooks/use-screen';
import { useHomeTab } from '@/screens/home/hooks';
import { useSettingsTab } from '@/screens/settings/settings/hooks';
import { useResultsTab } from '@/screens/results/results/hooks';
import { useWorkoutHubTab } from '@/screens/workouts/hub/hooks';
import { useTonyTab } from '@/screens/tony/hooks';

export default function TabLayout() {
    const { options } = useScreen();

    const home = useHomeTab();
    const exercises = useExercisesTab();
    const settings = useSettingsTab();
    const results = useResultsTab();
    const workout = useWorkoutHubTab();
    const tony = useTonyTab();

    return (
        <Tabs
            tabBar={(props) => <Menu {...props} />}
            screenOptions={{
                ...options,
                headerTitle: () => null,
                headerLeft: () => null,
            }}
        >
            <Tabs.Screen {...home} />
            <Tabs.Screen {...exercises} />
            <Tabs.Screen {...workout} />
            <Tabs.Screen {...results} />
            <Tabs.Screen {...tony} />
            {/* Still a tab route so `/settings` keeps working and the settings
                stack is unchanged — it simply has no button on the bar. */}
            <Tabs.Screen {...settings} />
        </Tabs>
    );
}
