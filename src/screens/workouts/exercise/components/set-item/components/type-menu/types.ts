import type { ReactNode } from 'react';

import type { ExerciseSetType } from '@/helpers/set-type';

export interface SetTypeMenuProps {
    setId: string;
    workoutExerciseId: string;
    setType: ExerciseSetType;
    children: ReactNode;
}
