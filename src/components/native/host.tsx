import { FC } from 'react';
import { Host as UIHost, type UniversalHostProps } from '@expo/ui';

import { colors } from '../../../unistyles';

/**
 * Root of every SwiftUI / Compose tree. iOS takes the coral as its tint;
 * Android is left on its default, which is Material You from the wallpaper.
 */
export const Host: FC<UniversalHostProps> = (props) => (
    <UIHost seedColor={process.env.EXPO_OS === 'ios' ? colors.brand[500] : undefined} {...props} />
);
