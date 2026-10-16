import { FC } from 'react';

import { usePlanSegmentStore } from '@/stores/plan-segment';
import ExercisesScreen from '@/screens/exercises/exercises';
import WorkoutHubScreen from '@/screens/workouts/hub';

/** The Plan tab's body. The Week / Library control itself is in the header. */
const PlanScreen: FC = () => {
    const segment = usePlanSegmentStore((state) => state.segment);

    return segment === 'library' ? <ExercisesScreen /> : <WorkoutHubScreen />;
};

export default PlanScreen;
