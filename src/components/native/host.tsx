import { FC } from 'react';
import { Host as UIHost, type UniversalHostProps } from '@expo/ui';

import { colors } from '../../../unistyles';

/** Root of every SwiftUI tree, tinted coral. (Android does not use these.) */
export const Host: FC<UniversalHostProps> = (props) => (
    <UIHost seedColor={colors.brand[500]} {...props} />
);
