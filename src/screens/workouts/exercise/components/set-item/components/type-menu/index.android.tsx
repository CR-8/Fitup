import { FC, useCallback } from 'react';

import { Pressable } from '@/components/primitives/pressable';
import { useActionsStore } from '@/stores/actions';

import type { SetTypeMenuProps } from './types';

/** The set-type badge opens the action sheet's set menu. */
export const SetTypeMenu: FC<SetTypeMenuProps> = ({
    setId,
    workoutExerciseId,
    setType,
    children,
}) => {
    const actionsOpen = useActionsStore((state) => state.open);

    const handleOpenSetMenu = useCallback(() => {
        actionsOpen({
            type: 'set__menu',
            payload: {
                setId,
                workoutExerciseId,
                setType,
            },
        });
    }, [actionsOpen, setId, setType, workoutExerciseId]);

    return <Pressable onPress={handleOpenSetMenu}>{children}</Pressable>;
};
