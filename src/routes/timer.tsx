import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { TimerScreen } from '@/screens';

const Timer = () => {
    useAnalyticsScreen('exercise_timer');

    return <TimerScreen />;
};

export default Timer;
