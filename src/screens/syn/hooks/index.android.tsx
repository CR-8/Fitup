import { useScreen } from '@/hooks/use-screen';

/** No tab header: Syn draws its own, as Today does (`components/header`). */
export const useSynTab = () => {
    const { options } = useScreen();

    return {
        name: 'syn',
        options: {
            ...options,
            headerShown: false,
        },
    };
};
