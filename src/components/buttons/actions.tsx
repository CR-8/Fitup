import { FC, ReactNode } from 'react';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';

import { HeaderButton } from './header';

export type { MenuAction };

interface ActionsMenuProps {
    actions: MenuAction[];
    onAction: (id: string) => void;
    /** The trigger; defaults to the header "…" glyph. */
    children?: ReactNode;
}

/** A native menu (UIMenu). Android lists actions in its action sheet instead. */
export const ActionsMenu: FC<ActionsMenuProps> = ({ actions, onAction, children }) => (
    <MenuView actions={actions} onPressAction={({ nativeEvent }) => onAction(nativeEvent.event)}>
        {children ?? <HeaderButton icon="ellipsis" />}
    </MenuView>
);
