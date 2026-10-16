import { TabStack } from '@/navigators/stack';
import { useYouTab } from '@/screens/settings/settings/hooks';

export default function YouLayout() {
    return <TabStack {...useYouTab()} />;
}
