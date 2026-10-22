import React from 'react';
import { Tabs } from 'expo-router';

import { Menu } from '@/components/overlays/menu';
import { useScreen } from '@/hooks/use-screen';
import { useHomeTab } from '@/screens/home/hooks';
import { useResultsTab } from '@/screens/results/results/hooks';
import { useSynTab } from '@/screens/syn/hooks';
import { useYouTab } from '@/screens/settings/settings/hooks';

/**
 * Android keeps the pre-native tab bar and headers. Each tab is a route group
 * (shared with iOS's native tabs), so the screens are addressed by group.
 */
export default function TabLayout() {
    const { options } = useScreen();

    const home = useHomeTab();
    const results = useResultsTab();
    const syn = useSynTab();
    const you = useYouTab();

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
            <Tabs.Screen name="(syn)" options={syn.options} />
            <Tabs.Screen name="(results)" options={results.options} />
            <Tabs.Screen name="(you)" options={you.options} />
        </Tabs>
    );
}
