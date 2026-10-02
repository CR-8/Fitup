import { useScreen } from '@/hooks/use-screen';

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
        },
    };
};
