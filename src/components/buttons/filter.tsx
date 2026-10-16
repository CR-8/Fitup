import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { HeaderButton } from './header';

export const FilterButton: FC<{ onPress: () => void; active?: boolean }> = ({
    onPress,
    active,
}) => {
    const { t } = useTranslation(['common']);

    return (
        <HeaderButton
            icon="filter"
            onPress={onPress}
            badge={active}
            accessibilityLabel={t('filter')}
        />
    );
};
