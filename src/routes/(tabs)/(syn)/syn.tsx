import { TabSwipe } from '@/components/layout/tab-swipe';
import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { SynScreen } from '@/screens';

const Syn = () => {
    // Wire value kept as 'tony' — renaming it would break the PostHog series
    // and orphan every funnel that references this screen historically.
    useAnalyticsScreen('tony');

    return (
        <TabSwipe index={1}>
            <SynScreen />
        </TabSwipe>
    );
};

export default Syn;
