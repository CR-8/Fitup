import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { useActionsStore } from '@/stores/actions';
import { useWorkoutExerciseMenu } from '@/hooks/use-action-menus';
import type { SetType } from '@/screens/workouts/exercise/helpers/add-set';

import { MenuItems } from '../../components/menu-item';

const WorkoutExerciseMenu: FC = () => {
    const { t } = useTranslation(['screens']);
    const payload = useActionsStore((state) => state.payload);
    const workoutId = payload && 'workoutId' in payload ? payload.workoutId : '';
    const workoutExerciseId =
        payload && 'workoutExerciseId' in payload ? payload.workoutExerciseId : '';

    const menu = useWorkoutExerciseMenu(workoutId, workoutExerciseId);

    if (!workoutId || !workoutExerciseId) return null;

    return (
        <MenuItems
            menu={menu}
            describe={(id) =>
                id.startsWith('add:')
                    ? t(`workoutExercise.addSet.${id.replace('add:', '') as SetType}.description`, {
                          ns: 'screens',
                      })
                    : undefined
            }
        />
    );
};

export { WorkoutExerciseMenu };
