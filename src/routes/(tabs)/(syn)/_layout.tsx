import { TabStack } from '@/navigators/stack';
import { useSynTab } from '@/screens/syn/hooks';

export default function SynLayout() {
    return <TabStack {...useSynTab()} />;
}
