import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { isAuthConfigured } from '@/constants/auth';
import { hasCompletedOnboarding } from '@/crud/onboarding';

import { useAccount } from './use-account';
import { useUser } from './use-user';

/**
 * Sends a first-time user to sign-in, then onboarding, exactly once.
 *
 * Both are skippable by design. Skipping records completion, so a user who
 * declines is never asked again — the app is usable with no account and no
 * profile, and the assistant simply falls back to general assumptions.
 */
export const useFirstLaunchGate = (): void => {
    const { user } = useUser();
    const { isSignedIn, isReady } = useAccount();
    const redirected = useRef(false);

    const { data: onboarded, isLoading } = useQuery({
        queryKey: ['onboarding', 'completed', user?.id],
        queryFn: () => hasCompletedOnboarding(user!.id),
        enabled: !!user?.id,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (redirected.current) return;
        if (!user?.id || !isReady || isLoading) return;
        if (onboarded) return;

        redirected.current = true;

        // A build with accounts offers sign-in first; without them, onboarding is
        // the only step and the sign-in screen would have nothing to show.
        const destination = isAuthConfigured() && !isSignedIn ? '/sign-in' : '/onboarding';
        router.replace(destination);
    }, [isLoading, isReady, isSignedIn, onboarded, user?.id]);
};
