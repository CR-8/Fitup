import { useTranslation } from 'react-i18next';

import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';

interface HeaderProps {
    exerciseName?: string;
    handleClose: () => void;
}

const Header = ({ exerciseName, handleClose }: HeaderProps) => {
    const { t } = useTranslation(['common']);

    return (
        <Stack.Screen
            options={{
                title: exerciseName ?? '',
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
