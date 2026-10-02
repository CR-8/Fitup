import { FC, PropsWithChildren } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

/*
 * The root stack's per-screen presentation on iOS: native sheets and pushes.
 * Android's pre-native presentation is in `root.android.tsx`.
 */

/** Sheets that rise over the app as a page sheet. */
const modal = { presentation: 'modal', headerShown: true } as const;
/** Pushed screens show the native bar, and with it the platform back button. */
const pushed = { headerShown: true } as const;

/** System font: nothing to load. */
export const useAppFonts = () => ({ fontsLoaded: true, fontsError: null });

/**
 * Native bars take light or dark from React Navigation's theme rather than the
 * window, so without this every bar drew light over the dark app — invisible
 * large titles, dark status bar text, light header menus.
 */
export const NavigationChrome: FC<PropsWithChildren> = ({ children }) => {
    const { rt } = useUnistyles();

    return (
        <ThemeProvider value={rt.themeName === 'dark' ? DarkTheme : DefaultTheme}>
            {children}
        </ThemeProvider>
    );
};

export const useRootScreens = () => ({
    modal,
    pushed,
    workoutExercise: modal,
    // The timer draws its own now-playing chrome, so it takes the whole screen.
    timer: { presentation: 'fullScreenModal' } as const,
    settings: (title: string) => ({ ...pushed, headerLargeTitle: true, title }),
    setting: (title: string) => ({ ...pushed, title }),
    /** A bare bar carrying only the platform back button. */
    auth: { headerShown: true, title: '' } as const,
});
