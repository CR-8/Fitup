import { TabStack } from '@/navigators/stack';
import { useResultsTab } from '@/screens/results/results/hooks';

export default function ResultsLayout() {
    return <TabStack {...useResultsTab()} />;
}
