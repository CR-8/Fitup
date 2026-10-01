import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HeaderButton } from '@/components/buttons/header';
import { useUser } from '@/hooks/use-user';

/**
 * The large title greets by name; settings — configuration, not a daily
 * destination, so not a tab — opens from the header.
 */
const useHomeTab = () => {
    const { t } = useTranslation(['screens']);
    const { user } = useUser();
    const name = user?.displayName?.trim();

    return {
        name: 'index',
        options: {
            title: name ? `${name} 👋` : t('home.greeting.fallback'),
            headerRight: () => (
                <HeaderButton
                    icon="settings"
                    onPress={() => router.navigate('/settings')}
                    accessibilityLabel={t('settings.title')}
                />
            ),
        },
    };
};

export { useHomeTab };
