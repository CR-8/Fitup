import { SummaryButton } from '@/components/buttons/summary';
import { useScreen } from '@/hooks/use-screen';

/** Syn's header on Android: transparent, with the way back to Summary. */
export const useSynTab = () => {
    const { options } = useScreen();

    return {
        name: 'syn',
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
