import { FC } from 'react';

import { ActionsMenu } from '@/components/buttons/actions';
import { useSetTypeMenu } from '@/hooks/use-action-menus';

import type { SetTypeMenuProps } from './types';

/** The set-type badge opens a native menu. */
export const SetTypeMenu: FC<SetTypeMenuProps> = ({ setId, setType, children }) => {
    const setTypeMenu = useSetTypeMenu(setId, setType);

    return <ActionsMenu {...setTypeMenu}>{children}</ActionsMenu>;
};
