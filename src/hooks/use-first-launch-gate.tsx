import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';
import { useURL } from 'expo-linking';
import { useQuery } from '@tanstack/react-query';

import { isAuthConfigured } from '@/constants/auth';
import { hasCompletedOnboarding } from '@/crud/onboarding';
import { isOAuthRedirectUrl } from '@/services/account';
import { isPasswordRecoveryPending } from '@/services/password-recovery';

import { useAccount } from './use-account';
import { useUser } from './use-user';

/**
 * Holds the app behind sign-in, then sends a new user through onboarding.
 *
 * An account is required. A build with no account backend configured is exempt,
 * because there would be no way to satisfy the requirement and the app would be
 * unusable — that is the only path that still reaches the app signed out.
 *
 * Onboarding remains skippable; skipping records completion, so a user who
 * declines is never asked again and the assistant falls back to general
 * assumptions.
 *
 * The root layout removes every app route from the navigator while signed out
 * (`src/routes/_layout.tsx`), which is what actually enforces the requirement.
 * This hook is the second line: it also covers the moment a session ends
 * mid-session, and it owns the onboarding step outright.
 */
/**
 * The screens that finish an authentication, and must be left to finish it.
 *
 * `/auth/callback` is the one that matters — it is mid-flight by definition and
 * self-limiting, redirecting on success, on failure, and on a timeout if no
 * redirect ever arrives. The other three sit either side of an email link and
 * have the same claim to be left alone.
 */
export const isAuthRoute = (pathname: string): boolean => pathname.startsWith('/auth/');

export const useFirstLaunchGate = (): void => {
    const { user } = useUser();
    /**
     * `isPrepared`, not `isReady`. Ready only means the stored session has been
     * read; prepared means the local user row that session owns has been
     * decided. Acting in the gap is what put people on About You for two
     * seconds after signing in: the cached answer was "not onboarded", correct
     * for the anonymous row this launch started with and stale the moment the
     * account adopted it.
     */
    const { isSignedIn, isPrepared } = useAccount();

    /**
     * The destination this hook last sent the user to, rather than a "have I
     * redirected" flag. A flag fires once per launch, so signing out after
     * onboarding — the exact case this is here for — was ignored.
     */
    const lastDestination = useRef<string | null>(null);

    const pathname = usePathname();

    /**
     * The same link the callback screen is waiting for.
     *
     * Read here as well as there because the route is not trustworthy this
     * early. `App` renders nothing until the user row and the stored session
     * have both resolved, so this effect can run before the router has settled
     * on `/auth/callback` — the pathname is still `/`, the pathname check below
     * passes, and the gate evicts a screen that had not finished mounting.
     *
     * The URL is true from the first read, whatever the router thinks.
     */
    const url = useURL();

    const { data: onboarded, isLoading } = useQuery({
        queryKey: ['onboarding', 'completed', user?.id],
        queryFn: () => hasCompletedOnboarding(user!.id),
        enabled: !!user?.id,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (!user?.id || !isPrepared || isLoading) return;

        // An email link is a cold start, and it launches the app straight onto
        // `/auth/callback` while still signed out. Every rule below then reads
        // that as "not signed in, send them to sign-in" and replaces the screen
        // before `useURL` has even delivered the link — so the tokens are never
        // exchanged and the flag below is never set.
        //
        // OAuth never showed this because it happens warm: the browser sheet
        // opens inside a running app whose gate has already fired, so the
        // repeat-destination check further down swallows the second attempt.
        // Arriving from an inbox there is no first attempt to swallow.
        //
        // Nothing here is needed on those screens anyway — the callback bounces
        // to sign-in on its own, and on a timeout if no redirect ever comes.
        if (isAuthRoute(pathname) || (url !== null && isOAuthRedirectUrl(url))) return;

        // A password-reset link signs the person in before they have set a new
        // password, which every rule below reads as an ordinary session and
        // routes accordingly — over the top of the screen asking for it. Read
        // straight from storage rather than through state so it is already true
        // on the first render after the session lands.
        if (isPasswordRecoveryPending()) return;

        // Resolved before onboarding: someone who completed onboarding earlier
        // and then signed out must still land on sign-in rather than back in
        // the app.
        const destination =
            isAuthConfigured() && !isSignedIn ? '/sign-in' : onboarded ? null : '/onboarding';

        // Cleared once the gate is satisfied, so a later sign-out routes again
        // instead of being swallowed as a repeat of the same destination.
        if (destination === null) {
            lastDestination.current = null;
            return;
        }

        if (destination === lastDestination.current) return;

        lastDestination.current = destination;
        router.replace(destination);
    }, [isLoading, isPrepared, isSignedIn, onboarded, pathname, url, user?.id]);
};
