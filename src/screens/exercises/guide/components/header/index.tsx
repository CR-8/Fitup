import { useTranslation } from 'react-i18next';

import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';

interface HeaderProps {
    handleClose: () => void;
}

const Header = ({ handleClose }: HeaderProps) => {
    const { t } = useTranslation(['common', 'screens']);

    return (
        <Stack.Screen
            options={{
                title: t('exercise.tabs.guide', { ns: 'screens' }),
                headerRight: () => (
                    <HeaderTextButton
                        title={t('done', { ns: 'common' })}
                        onPress={handleClose}
                        prominent
                    />
                ),
            }}
        />
    );
};

export { Header };
