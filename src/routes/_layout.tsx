import 'react-native-reanimated';
import { FC, useEffect } from 'react';
import { useURL } from 'expo-linking';
import { useTranslation } from 'react-i18next';
import * as SplashScreen from 'expo-splash-screen';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import dayjs from 'dayjs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import migrations from '../../drizzle/migrations';

import { db, dbConnection } from '@/db';
import i18n from '@/locale/i18n';
import { useUser, UserProvider } from '@/hooks/use-user';
import { queryClient } from '@/queries';
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

/** Sheets that rise over the app: a page sheet on iOS, a slide-up on Android. */
const modal = { presentation: 'modal', headerShown: true } as const;
/** Pushed screens show the native bar, and with it the platform back button. */
const pushed = { headerShown: true } as const;

const SETTINGS_SCREENS = [
    ['account', 'account'],
    ['profile', 'profile'],
    ['autolock', 'autolock'],
    ['notifications', 'notifications'],
    ['theme', 'theme'],
    ['sound', 'sound'],
    ['datetime', 'dateTime'],
    ['units', 'units'],
    ['language', 'language'],
    ['heartrate', 'heartRate'],
] as const;

/** A bare bar carrying only the platform back button. */
const backOnly = { headerShown: true, title: '' } as const;
// The timer draws its own now-playing chrome, so it takes the whole screen.
const fullScreenModal = { presentation: 'fullScreenModal' } as const;

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
    const { t } = useTranslation(['screens']);
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
        <RunningWorkoutProvider>
            <StoreReviewGateProvider>
                <PendingStoreReviewCoordinator />
                <Stack
                    screenOptions={{
                        ...options,
                        headerShown: false,
                    }}
                >
                    {/* Removing these from the navigator — rather than
                                redirecting away from them — is what makes signing out a
                                real logout: their history entries go with them, so back
                                cannot re-enter the app. */}
                    <Stack.Protected guard={!authRequired || isSignedIn}>
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="onboarding" />
                        <Stack.Screen name="diet" options={modal} />
                        <Stack.Screen name="timer" options={fullScreenModal} />
                        <Stack.Screen name="workout/[workoutId]" options={pushed} />
                        <Stack.Screen
                            name="workout/[workoutId]/[workoutExerciseId]"
                            options={modal}
                        />
                        <Stack.Screen name="exercises/[exerciseId]" options={pushed} />
                        <Stack.Screen
                            name="settings/index"
                            options={{
                                ...pushed,
                                headerLargeTitle: true,
                                title: t('settings.title'),
                            }}
                        />
                        {SETTINGS_SCREENS.map(([name, key]) => (
                            <Stack.Screen
                                key={name}
                                name={`settings/${name}`}
                                options={{ ...pushed, title: t(`settings.items.${key}.title`) }}
                            />
                        ))}
                        <Stack.Screen name="editor" options={modal} />
                        <Stack.Screen name="select" options={modal} />
                        <Stack.Screen name="preview" options={modal} />
                        <Stack.Screen name="guide" options={modal} />
                        <Stack.Screen name="review" options={modal} />
                        <Stack.Screen name="day" options={modal} />
                        <Stack.Screen name="filter" options={modal} />
                    </Stack.Protected>

                    {/* After the protected group, not before: when a navigator has to
                                pick a screen on its own — a development reload did exactly
                                that — it takes the first one declared. First was sign-in, so
                                a signed-in user was put in front of the sign-in form with
                                nothing to move them on. Signed out, the protected screens
                                are gone and sign-in is first again. */}
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
                    <Stack.Screen name="auth/forgot-password" options={backOnly} />
                    <Stack.Screen name="auth/check-email" options={backOnly} />
                    <Stack.Screen name="auth/new-password" options={backOnly} />
                </Stack>
                <Actions />
                <RestInput />
            </StoreReviewGateProvider>
        </RunningWorkoutProvider>
    );
};

/**
 * Drizzle Studio's devtools bridge, isolated and opt-in.
 *
 * `useDrizzleStudio` calls `useDevToolsPluginClient` unconditionally, before it
 * looks at the database handed to it — so passing `null` does not switch it off,
 * it only stops the queries. When that websocket cannot be set up the hook
 * throws, and called from `RootLayout` that turned a missing debug tool into
 * "Render Error: Failed to setup client from useDevToolsPluginClient" for the
 * entire app, with no way past it.
 *
 * A component rather than a hook so the call itself can be skipped — hooks
 * cannot be conditional, components can. Off unless `EXPO_PUBLIC_DRIZZLE_STUDIO`
 * is set, so inspecting the database is something you ask for rather than
 * something that can cost you the app.
 */
const DrizzleStudio: FC = () => {
    useDrizzleStudio(dbConnection);

    return null;
};

const isDrizzleStudioEnabled =
    process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_DRIZZLE_STUDIO === '1';

const RootLayout: FC = () => {
    const { success: dbSuccess, error: dbError } = useMigrations(db, migrations);

    useEffect(() => {
        if (dbError) throw dbError;
    }, [dbError]);

    if (!dbSuccess) {
        return null;
    }

    return (
        <GestureHandlerRootView>
            {isDrizzleStudioEnabled && <DrizzleStudio />}
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
