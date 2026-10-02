import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';

/**
 * The system tab bar (Liquid Glass). Settings is not a tab; it opens from
 * Home's header. Android keeps its pre-native tab bar: `_layout.android.tsx`.
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
            <NativeTabs.Trigger name="(exercises)">
                <NativeTabs.Trigger.Icon sf="figure.strengthtraining.traditional" />
                <NativeTabs.Trigger.Label>{t('exercises.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(workouts)">
                <NativeTabs.Trigger.Icon sf="dumbbell" md="exercise" />
                <NativeTabs.Trigger.Label>{t('workouts.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(results)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
                />
                <NativeTabs.Trigger.Label>{t('results.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(syn)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }}
                />
                <NativeTabs.Trigger.Label>{t('syn.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
