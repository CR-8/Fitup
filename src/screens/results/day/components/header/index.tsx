import { useTranslation } from 'react-i18next';

import { HeaderTextButton } from '@/components/buttons/header';
import { Stack } from '@/navigators/stack';

interface HeaderProps {
    title: string;
    handleClose: () => void;
}

const Header = ({ title, handleClose }: HeaderProps) => {
    const { t } = useTranslation(['common']);

    return (
        <Stack.Screen
            options={{
                title,
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
