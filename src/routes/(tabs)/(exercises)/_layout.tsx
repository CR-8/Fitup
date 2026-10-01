import { TabStack } from '@/navigators/stack';
import { useExercisesTab } from '@/screens/exercises/exercises/hooks';

export default function ExercisesLayout() {
    return <TabStack {...useExercisesTab()} />;
}
