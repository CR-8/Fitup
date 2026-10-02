import { FC } from 'react';
import { SymbolView } from 'expo-symbols';
import { useUnistyles } from 'react-native-unistyles';

import { icons, type IconName, type IconProps } from '@/theme/icons';

export type { IconName, IconProps };

export const Icon: FC<IconProps> = ({ name, size = 20, color, style }) => {
    const { theme } = useUnistyles();

    return (
        <SymbolView
            name={icons[name]}
            size={size}
            tintColor={color ?? theme.colors.typography}
            style={style}
        />
    );
};
