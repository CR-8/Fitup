import { FC } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useUnistyles } from 'react-native-unistyles';

import { icons, type IconName } from '@/theme/icons';

export type { IconName };

export interface IconProps {
    name: IconName;
    size?: number;
    color?: ColorValue;
    style?: StyleProp<ViewStyle>;
}

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
