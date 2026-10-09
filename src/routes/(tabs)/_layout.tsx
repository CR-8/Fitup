import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';

/**
 * The system tab bar (Liquid Glass): Home, the Monthly Tracker, and the AI
 * plan. Three, because those are the three jobs — what to do this week, how
 * the month went, and getting a plan. Starting or building a workout lives on
 * Home; the exercise library is reached from the exercise picker and from each
 * personal record. Settings is not a tab; it opens from Home's header. Android
 * keeps its pre-native tab bar: `_layout.android.tsx`.
 */
export default function TabLayout() {
    const { t } = useTranslation(['menu']);
    const { theme } = useUnistyles();

    return (
        <NativeTabs tintColor={theme.colors.primary}>
            <NativeTabs.Trigger name="(home)">
                <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
                <NativeTabs.Trigger.Label>{t('home.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(results)">
                <NativeTabs.Trigger.Icon sf="calendar" />
                <NativeTabs.Trigger.Label>{t('results.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(syn)">
                <NativeTabs.Trigger.Icon sf="sparkles" />
                <NativeTabs.Trigger.Label>{t('syn.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
