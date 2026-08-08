import React from 'react';
import { Tabs } from 'expo-router';

import { Menu } from '@/components/overlays/menu';
import { useExercisesTab } from '@/screens/exercises/exercises/hooks';
import { useScreen } from '@/hooks/use-screen';
import { useHomeTab } from '@/screens/home/hooks';
import { useSettingsTab } from '@/screens/settings/settings/hooks';
import { useResultsTab } from '@/screens/results/results/hooks';
import { useTonyTab } from '@/screens/tony/hooks';

export default function TabLayout() {
    const { options } = useScreen();

    const home = useHomeTab();
    const exercises = useExercisesTab();
    const settings = useSettingsTab();
    const results = useResultsTab();
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
            <Tabs.Screen {...results} />
            <Tabs.Screen {...tony} />
            <Tabs.Screen {...exercises} />
            <Tabs.Screen {...settings} />
        </Tabs>
    );
}
