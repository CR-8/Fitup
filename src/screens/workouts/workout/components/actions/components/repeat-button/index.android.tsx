import { FC, useCallback } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/buttons/base';
import { useActionsStore } from '@/stores/actions';

import type { RepeatButtonProps } from './types';

const styles = StyleSheet.create((theme) => ({
    customStartButtonText: {
        fontSize: theme.fontSize.lg.fontSize,
    },
}));

export const RepeatButton: FC<RepeatButtonProps> = ({ workoutId, title, loading }) => {
    const { actionsOpen } = useActionsStore(
        useShallow((state) => ({
            actionsOpen: state.open,
        })),
    );

    const handleRepeat = useCallback(() => {
        actionsOpen({
            type: 'workout__repeat',
            showCloseButton: false,
            payload: { workoutId },
        });
    }, [actionsOpen, workoutId]);

    return (
        <Button
            title={title}
            type="primary"
            textStyle={styles.customStartButtonText}
            loading={loading}
            onPress={handleRepeat}
        />
    );
};
