import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ActionsMenu } from '@/components/buttons/actions';
import { useDuplicateMenu } from '@/hooks/use-action-menus';

import type { RepeatButtonProps } from './types';

const styles = StyleSheet.create((theme) => ({
    // A completed workout's main action opens the repeat menu, so its trigger
    // is drawn as the prominent button rather than being one.
    menuTrigger: {
        height: 50,
        paddingHorizontal: theme.space(12),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuTriggerText: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primaryTypography,
    },
}));

export const RepeatButton: FC<RepeatButtonProps> = ({ workoutId, title }) => {
    const repeatMenu = useDuplicateMenu(workoutId, 'repeat');

    return (
        <ActionsMenu {...repeatMenu}>
            <Box style={styles.menuTrigger}>
                <Text style={styles.menuTriggerText}>{title}</Text>
            </Box>
        </ActionsMenu>
    );
};
