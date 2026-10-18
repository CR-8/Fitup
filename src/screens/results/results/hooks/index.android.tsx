import { SummaryButton } from '@/components/buttons/summary';
import { useScreen } from '@/hooks/use-screen';

/** Progress's header on Android: transparent, with the way back to Summary. */
export const useResultsTab = () => {
    const { options } = useScreen();
    return {
        name: 'results',
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => <SummaryButton />,
        },
    };
};
