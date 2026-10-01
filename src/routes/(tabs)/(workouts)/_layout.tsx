import { TabStack } from '@/navigators/stack';
import { useWorkoutHubTab } from '@/screens/workouts/hub/hooks';

export default function WorkoutsLayout() {
    return <TabStack {...useWorkoutHubTab()} />;
}
