import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';

/**
 * The system tab bar (Liquid Glass): Today, Coach, Progress. Plan and You are
 * off the navigation; settings opens from Today's avatar. Android keeps its
 * pre-native tab bar: `_layout.android.tsx`.
 */
export default function TabLayout() {
    const { t } = useTranslation(['menu']);
    const { theme } = useUnistyles();

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
        </NativeTabs>
    );
}
