import 'react-native-reanimated';
import { FC, useEffect } from 'react';
import { useURL } from 'expo-linking';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import dayjs from 'dayjs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import migrations from '../../drizzle/migrations';

import { db, dbConnection } from '@/db';
import i18n from '@/locale/i18n';
import { useUser, UserProvider } from '@/hooks/use-user';
import { queryClient } from '@/queries';
import { SyncProvider } from '@/hooks/use-sync';
import { Stack } from '@/navigators/stack';
import { useScreen } from '@/hooks/use-screen';
import { NotificationsProvider } from '@/hooks/use-notifications';
import Actions from '@/components/overlays/actions';
import RestInput from '@/components/overlays/rest';
import { RunningWorkoutProvider } from '@/hooks/use-running-workout';
import { AnalyticsProvider } from '@/hooks/use-analytics';
import { AnalyticsTracker } from '@/analytics/tracker';
import { useHealthImporter } from '@/hooks/use-health-importer';
import { useExerciseCatalogue } from '@/hooks/use-exercise-catalogue';
import { AccountProvider, useAccount } from '@/hooks/use-account';
import { isAuthConfigured } from '@/constants/auth';
import { useFirstLaunchGate } from '@/hooks/use-first-launch-gate';
import { isOAuthRedirectUrl } from '@/services/account';
import { noteAuthRedirect } from '@/services/auth-redirect';
import { PendingStoreReviewCoordinator } from '@/hooks/use-pending-store-review';
import { StoreReviewGateProvider } from '@/hooks/use-store-review-gate';

import 'dayjs/locale/en';
import 'dayjs/locale/hi';
import { AudioProvider } from '@/hooks/use-audio';

export { ErrorBoundary } from 'expo-router';

// Set initial dayjs locale
dayjs.locale(i18n.language);

// Listen for language changes and update dayjs locale
i18n.on('languageChanged', (lng) => {
    dayjs.locale(lng);
});

const navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    debug: false,
    tracesSampleRate: 0,
    integrations: [navigationIntegration],
    enableNativeFramesTracking: !isRunningInExpoGo(),
});

export const unstable_settings = {
    initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

/**
 * Hears the redirect, so a screen that mounts because of it does not have to.
 *
 * Mounted for the life of the app, which is the only position from which both
 * arrivals are visible: the launch URL of a cold start, and the event delivered
 * to an app already running. `/auth/callback` can only ever see the first.
 */
const useAuthRedirectCapture = (): void => {
    const url = useURL();

    useEffect(() => {
        if (url && isOAuthRedirectUrl(url)) noteAuthRedirect(url);
    }, [url]);
};

const App: FC = () => {
    const { user } = useUser();
    const { options } = useScreen();
    const { isSignedIn, isReady } = useAccount();

    useAuthRedirectCapture();

    // A build with no account backend cannot require an account; it would be
    // unusable. That is the only configuration that reaches the app signed out.
    const authRequired = isAuthConfigured();

    useHealthImporter(user ?? undefined);
    useExerciseCatalogue();
    useFirstLaunchGate();

    // Held until the stored session has been read as well as the user row, or the
    // splash would lift onto the blank frame below rather than onto a screen.
    const ready = !!user && (!authRequired || isReady);

    useEffect(() => {
        if (ready) {
            SplashScreen.hideAsync();
        }
    }, [ready]);

    // Rendering nothing until the session is known is what stops a signed-in user
    // seeing sign-in flash past on the way to Home.
    if (!ready) return null;

    return (
        <SyncProvider>
            <RunningWorkoutProvider>
                <StoreReviewGateProvider>
                    <PendingStoreReviewCoordinator />
                    <BottomSheetModalProvider>
                        <Stack
                            screenOptions={{
                                ...options,
                                headerShown: false,
                            }}
                        >
                            {/* Reachable without a session: sign-in itself, the
                                redirect target — which by definition lands before
                                one exists — and the three screens either side of an
                                email link.

                                `auth/new-password` is here rather than behind the
                                guard on purpose. A reset link does open a session,
                                so the guard would admit it, but the screen has to
                                survive its own sign-out escape hatch, and it is
                                pre-session in every sense that matters. */}
                            <Stack.Screen name="sign-in" />
                            <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
                            <Stack.Screen name="auth/forgot-password" />
                            <Stack.Screen name="auth/check-email" />
                            <Stack.Screen name="auth/new-password" />

                            {/* Removing these from the navigator — rather than
                                redirecting away from them — is what makes signing out a
                                real logout: their history entries go with them, so back
                                cannot re-enter the app. */}
                            <Stack.Protected guard={!authRequired || isSignedIn}>
                                <Stack.Screen name="(tabs)" />
                                <Stack.Screen name="onboarding" />
                                <Stack.Screen
                                    name="diet"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="timer"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen name="workout" />
                                <Stack.Screen name="settings" />
                                <Stack.Screen
                                    name="editor"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="select"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="preview"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="guide"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="review"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="day"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="filter"
                                    options={{
                                        presentation: 'card',
                                        animationTypeForReplace: 'pop',
                                        cardOverlayEnabled: false,
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                            </Stack.Protected>
                        </Stack>
                        <Actions />
                        <RestInput />
                    </BottomSheetModalProvider>
                </StoreReviewGateProvider>
            </RunningWorkoutProvider>
        </SyncProvider>
    );
};

const RootLayout: FC = () => {
    const { success: dbSuccess, error: dbError } = useMigrations(db, migrations);

    useDrizzleStudio(process.env.NODE_ENV !== 'production' ? dbConnection : null);

    // Keys are the strings `src/theme/fonts.ts` hands to `fontFamily`. The six
    // Inter faces this replaces were loaded and never used — nothing in the app
    // set a `fontFamily` at all, so every screen rendered in the system font.
    const [fontsLoaded, fontsError] = useFonts({
        DMSans_400Regular: require('../../assets/fonts/DMSans-Regular.ttf'),
        DMSans_500Medium: require('../../assets/fonts/DMSans-Medium.ttf'),
        DMSans_600SemiBold: require('../../assets/fonts/DMSans-SemiBold.ttf'),
        DMSans_700Bold: require('../../assets/fonts/DMSans-Bold.ttf'),
        SpaceGrotesk_500Medium: require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
        SpaceGrotesk_600SemiBold: require('../../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
        SpaceGrotesk_700Bold: require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
    });

    useEffect(() => {
        if (fontsError) throw fontsError;
        if (dbError) throw dbError;
    }, [dbError, fontsError]);

    if (!dbSuccess || !fontsLoaded) {
        return null;
    }

    return (
        <GestureHandlerRootView>
            <KeyboardProvider>
                <QueryClientProvider client={queryClient}>
                    {/* Above `UserProvider`, which is what stops the local user
                        row being created before anyone knows whether a session
                        is being restored — the race that used to leave a second,
                        unlinked user behind on the first launch after an
                        upgrade. `AccountProvider` no longer reads `useUser`, so
                        this nesting is available. */}
                    <AccountProvider>
                        <UserProvider>
                            <AnalyticsProvider>
                                <NotificationsProvider>
                                    <AnalyticsTracker />
                                    <AudioProvider>
                                        <App />
                                    </AudioProvider>
                                </NotificationsProvider>
                            </AnalyticsProvider>
                        </UserProvider>
                    </AccountProvider>
                </QueryClientProvider>
            </KeyboardProvider>
        </GestureHandlerRootView>
    );
};

export default Sentry.wrap(RootLayout);
