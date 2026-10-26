import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';

import { NowPlayingRow } from '@/components/overlays/now-playing';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';

/**
 * The system tab bar (Liquid Glass): Home, Syn, Progress, Profile. A
 * running workout sits in the bar's bottom accessory. Android keeps its
 * pre-native tab bar: `_layout.android.tsx`.
 */
export default function TabLayout() {
    const { t } = useTranslation(['menu']);
    const { theme } = useUnistyles();
    const { runningWorkout } = useRunningWorkoutStatic();

    return (
        <NativeTabs tintColor={theme.colors.primary}>
            <NativeTabs.Trigger name="(home)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'house', selected: 'house.fill' }}
                    md="home"
                />
                <NativeTabs.Trigger.Label>{t('home.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(syn)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }}
                    md="chat"
                />
                <NativeTabs.Trigger.Label>{t('syn.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(results)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
                    md="bar_chart"
                />
                <NativeTabs.Trigger.Label>{t('results.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(you)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
                    md="person"
                />
                <NativeTabs.Trigger.Label>{t('you.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            {runningWorkout ? (
                <NativeTabs.BottomAccessory>
                    <NowPlayingRow compact />
                </NativeTabs.BottomAccessory>
            ) : null}
        </NativeTabs>
    );
}
