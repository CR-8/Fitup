import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SummaryEditScreen from '@/screens/summary-edit';

const Route = () => {
    useAnalyticsScreen('summary_edit');

    return <SummaryEditScreen />;
};

export default Route;
