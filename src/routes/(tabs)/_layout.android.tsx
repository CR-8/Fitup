import React from 'react';
import { Tabs } from 'expo-router';

import { NowPlaying } from '@/components/overlays/now-playing';
import { useScreen } from '@/hooks/use-screen';
import { useHomeTab } from '@/screens/home/hooks';
import { useResultsTab } from '@/screens/results/results/hooks';
import { useSynTab } from '@/screens/syn/hooks';

/**
 * Today, Syn and Progress with no tab bar, as on iOS: Today is the hub, a swipe
 * slides between the three, and a running workout floats as a now-playing pill
 * where the bar was. Android draws each screen's header here, by route group.
 */
export default function TabLayout() {
    const { options } = useScreen();

    const home = useHomeTab();
    const results = useResultsTab();
    const syn = useSynTab();

    return (
        <Tabs
            tabBar={() => <NowPlaying />}
            screenOptions={{
                ...options,
                animation: 'shift',
                headerTitle: () => null,
                headerLeft: () => null,
            }}
        >
            <Tabs.Screen name="(home)" options={home.options} />
            <Tabs.Screen name="(syn)" options={syn.options} />
            <Tabs.Screen name="(results)" options={results.options} />
        </Tabs>
    );
}
