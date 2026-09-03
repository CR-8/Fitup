import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { isAuthConfigured } from '@/constants/auth';
import { hasCompletedOnboarding } from '@/crud/onboarding';

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

    const { data: onboarded, isLoading } = useQuery({
        queryKey: ['onboarding', 'completed', user?.id],
        queryFn: () => hasCompletedOnboarding(user!.id),
        enabled: !!user?.id,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (!user?.id || !isPrepared || isLoading) return;

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
    }, [isLoading, isPrepared, isSignedIn, onboarded, user?.id]);
};
