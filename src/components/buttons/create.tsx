import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { HeaderButton } from './header';

export const CreateButton: FC<{ onPressHandler: () => void }> = ({ onPressHandler }) => {
    const { t } = useTranslation(['common']);

    return <HeaderButton icon="plus" onPress={onPressHandler} accessibilityLabel={t('create')} />;
};
