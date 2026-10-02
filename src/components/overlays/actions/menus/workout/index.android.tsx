import { FC } from 'react';

import { useActionsStore } from '@/stores/actions';
import { useWorkoutMenu } from '@/hooks/use-action-menus';

import { MenuItems } from '../../components/menu-item';

const WorkoutMenu: FC = () => {
    const payload = useActionsStore((state) => state.payload);
    const workoutId = payload && 'workoutId' in payload ? payload.workoutId : '';

    return <MenuItems menu={useWorkoutMenu(workoutId)} />;
};

export { WorkoutMenu };
