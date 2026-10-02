import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';

interface HeaderProps {
    handleClose: () => void;
    /** Writes the form to the filter store as the sheet goes. */
    onSave: () => void;
}

const Header = ({ handleClose, onSave }: HeaderProps) => {
    const { t } = useTranslation(['common', 'screens']);

    // On the way out however the sheet goes — Done, swipe, or back — so a
    // swiped-away filter still applies.
    useEffect(() => () => onSave(), []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Stack.Screen
            options={{
                title: t('filter.title', { ns: 'screens' }),
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
