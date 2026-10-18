import { Tabs } from 'expo-router';

import { NowPlaying } from '@/components/overlays/now-playing';

/**
 * Today, Syn and Progress, side by side with no tab bar: Today is the hub,
 * with Syn in its header and a Progress card, and a swipe moves between the
 * three (`TabSwipe`), sliding. Each keeps its own native stack (the groups'
 * layouts), so Syn and Progress still have their large titles and a way back.
 * Where the bar was, a running workout floats as a now-playing pill.
 */
export default function TabLayout() {
    return (
        <Tabs
            tabBar={() => <NowPlaying />}
            screenOptions={{ headerShown: false, animation: 'shift' }}
        >
            <Tabs.Screen name="(home)" />
            <Tabs.Screen name="(syn)" />
            <Tabs.Screen name="(results)" />
        </Tabs>
    );
}
