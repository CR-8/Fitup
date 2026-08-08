import { useScreen } from '@/hooks/use-screen';

export const useTonyTab = () => {
    const { options } = useScreen();

    return {
        name: 'tony',
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
