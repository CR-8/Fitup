import { FC } from 'react';

import { useActionsStore } from '@/stores/actions';
import { useExerciseMenu } from '@/hooks/use-action-menus';

import { MenuItems } from '../../components/menu-item';

const ExerciseMenu: FC = () => {
    const payload = useActionsStore((state) => state.payload);
    const exerciseId = payload && 'exerciseId' in payload ? payload.exerciseId : '';

    return <MenuItems menu={useExerciseMenu(exerciseId)} />;
};

export { ExerciseMenu };
