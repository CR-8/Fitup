import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';

/**
 * The system tab bar: Liquid Glass on iOS, a Material 3 navigation bar on
 * Android. Settings is not a tab; it opens from Home's header.
 */
export default function TabLayout() {
    const { t } = useTranslation(['menu']);
    const { theme } = useUnistyles();

    return (
        <NativeTabs
            tintColor={theme.colors.primary}
            backgroundColor={
                process.env.EXPO_OS === 'android' ? theme.colors.foreground : undefined
            }
        >
            <NativeTabs.Trigger name="(home)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'house', selected: 'house.fill' }}
                    md="home"
                />
                <NativeTabs.Trigger.Label>{t('home.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(exercises)">
                <NativeTabs.Trigger.Icon
                    sf="figure.strengthtraining.traditional"
                    md="fitness_center"
                />
                <NativeTabs.Trigger.Label>{t('exercises.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(workouts)">
                <NativeTabs.Trigger.Icon sf="dumbbell" md="exercise" />
                <NativeTabs.Trigger.Label>{t('workouts.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(results)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
                    md="bar_chart"
                />
                <NativeTabs.Trigger.Label>{t('results.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="(syn)">
                <NativeTabs.Trigger.Icon
                    sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }}
                    md="chat"
                />
                <NativeTabs.Trigger.Label>{t('syn.title')}</NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
