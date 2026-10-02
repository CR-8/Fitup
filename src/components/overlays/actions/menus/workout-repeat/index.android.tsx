import { FC } from 'react';

import { useActionsStore } from '@/stores/actions';
import { useDuplicateMenu } from '@/hooks/use-action-menus';

import { MenuItems } from '../../components/menu-item';

const WorkoutRepeat: FC = () => {
    const payload = useActionsStore((state) => state.payload);
    const workoutId = payload && 'workoutId' in payload ? payload.workoutId : '';

    return <MenuItems menu={useDuplicateMenu(workoutId, 'repeat')} />;
};

export { WorkoutRepeat };
