import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Host, Image, Menu } from '@expo/ui/swift-ui';

import { Box } from '@/components/primitives/box';

import type { GoalMenuProps } from './types';

/** The ring's goal button: a native SwiftUI menu. Android draws its own (`index.android.tsx`). */

const styles = StyleSheet.create((theme) => ({
    button: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.elevated,
    },
}));

export const GoalMenu: FC<GoalMenuProps> = ({ color, labels, onAdjustToday, onChangeDaily }) => (
    <Box style={styles.button}>
        <Host matchContents>
            <Menu label={<Image systemName="plusminus" size={18} color={color} />}>
                <Button
                    label={labels.today}
                    systemImage="calendar.badge.clock"
                    onPress={onAdjustToday}
                />
                <Button label={labels.daily} systemImage="calendar" onPress={onChangeDaily} />
            </Menu>
        </Host>
    </Box>
);
