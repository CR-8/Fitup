import { FC } from 'react';

import { HeaderButton } from './header';

export const FilterButton: FC<{ onPress: () => void; active?: boolean }> = ({
    onPress,
    active,
}) => <HeaderButton icon="filter" onPress={onPress} badge={active} />;
