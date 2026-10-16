import { BackButton } from '@/components/buttons/back';
import { useScreen } from '@/hooks/use-screen';
import { router } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

const useSettingsTab = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();

    return {
        name: 'settings',
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            sceneStyle: {
                ...options.sceneStyle,
                backgroundColor: theme.colors.foreground,
            },
        },
    };
};

/** Settings as the You tab: the tab navigator draws its transparent header. */
const useYouTab = () => {
    const { t } = useTranslation(['screens']);
    const { options } = useScreen();

    return {
        name: 'you',
        options: {
            ...options,
            title: t('you.title'),
            headerTransparent: true,
            headerStyle: { ...options.headerStyle, backgroundColor: 'transparent' },
        },
    };
};

const useSettingScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();

    const handleBack = () => {
        router.back();
    };

    return {
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            cardStyle: {
                ...options.sceneStyle,
                backgroundColor: theme.colors.foreground,
            },
            headerLeft: () => (
                <BackButton
                    onPressHandler={handleBack}
                    backgroundColor={theme.solid.foreground}
                    iconColor={theme.solid.typography}
                />
            ),
        },
    };
};

export { useSettingsTab, useSettingScreen, useYouTab };
