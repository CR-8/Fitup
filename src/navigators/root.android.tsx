import { FC, PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { useUnistyles } from 'react-native-unistyles';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { BackButton } from '@/components/buttons/back';
import { useSettingScreen } from '@/screens/settings/settings/hooks';

/*
 * The root stack's per-screen presentation on Android: the pre-native UI's JS
 * stack, with its own headers and sheets. iOS's is in `root.tsx`.
 */

/** Rises from the bottom as a full card. */
const slideUp = {
    presentation: 'card',
    animationTypeForReplace: 'pop',
    cardOverlayEnabled: false,
    animation: 'slide_from_bottom',
} as const;

/** Keys are the names `src/theme/fonts.ts` hands to `fontFamily`. */
export const useAppFonts = () => {
    const [fontsLoaded, fontsError] = useFonts({
        DMSans_400Regular: require('../../assets/fonts/DMSans-Regular.ttf'),
        DMSans_500Medium: require('../../assets/fonts/DMSans-Medium.ttf'),
        DMSans_600SemiBold: require('../../assets/fonts/DMSans-SemiBold.ttf'),
        DMSans_700Bold: require('../../assets/fonts/DMSans-Bold.ttf'),
        SpaceGrotesk_500Medium: require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
        SpaceGrotesk_600SemiBold: require('../../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
        SpaceGrotesk_700Bold: require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
    });

    return { fontsLoaded, fontsError };
};

/** The action, rest and choice sheets are bottom-sheet modals. */
export const NavigationChrome: FC<PropsWithChildren> = ({ children }) => (
    <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
);

export const useRootScreens = () => {
    const { theme } = useUnistyles();
    const { options: setting } = useSettingScreen();

    return {
        modal: slideUp,
        pushed: {},
        workoutExercise: {},
        timer: slideUp,
        // Settings draws its own title.
        settings: (_title: string) => ({
            ...setting,
            headerShown: true,
            headerTitle: () => null,
        }),
        setting: (title: string) => ({
            ...setting,
            headerShown: true,
            headerTitle: title,
            headerLeft: () => (
                <BackButton
                    onPressHandler={() => router.back()}
                    backgroundColor={theme.solid.background}
                    iconColor={theme.solid.typography}
                />
            ),
        }),
        // The auth screens draw their own way back.
        auth: {},
    };
};
