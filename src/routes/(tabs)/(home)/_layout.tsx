import { TabStack } from '@/navigators/stack';
import { useHomeTab } from '@/screens/home/hooks';

export default function HomeLayout() {
    return <TabStack {...useHomeTab()} />;
}
