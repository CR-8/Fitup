import { useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useURL } from 'expo-linking';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { useUser } from '@/hooks/use-user';
import { hasCompletedOnboarding } from '@/crud/onboarding';
import {
    AuthError,
    claimOAuthNavigation,
    completeOAuthRedirect,
    getSession,
    isOAuthRedirectUrl,
} from '@/services/account';
import { reportError } from '@/services/error-reporting';

/**
 * Lands the OAuth redirect when Android delivers it as a deep link instead of letting
 * `openAuthSessionAsync` capture it. Without this route the URL resolves to nothing
 * and the tokens are lost behind the not-found screen.
 *
 * The screen deliberately renders nothing but a background. It exists to hold the
 * redirect for the few hundred milliseconds the exchange takes, and anything animated
 * here would only flash on its way out.
 */

/** How long to wait for a redirect before accepting that none is coming. */
const REDIRECT_TIMEOUT_MS = 10_000;

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
}));

const AuthCallbackScreen = () => {
    const { user } = useUser();
    const userId = user?.id;
    const url = useURL();
    const hasActed = useRef(false);

    /**
     * Screen-scoped: this screen has three ways to finish and must take only one of
     * them. Distinct from `claimOAuthNavigation`, which arbitrates between *screens* —
     * the timeout below depends on this one alone, so that a claim left over from an
     * earlier sign-in can never strand the user on an empty background.
     */
    const actOnce = useCallback((): boolean => {
        if (hasActed.current) return false;
        hasActed.current = true;
        return true;
    }, []);

    const goOnward = useCallback(async (id: string): Promise<void> => {
        const onboarded = await hasCompletedOnboarding(id);
        router.replace(onboarded ? '/' : '/onboarding');
    }, []);

    // The redirect itself, whenever it arrives.
    useEffect(() => {
        if (!userId || !url) return;

        // `useURL` reports whatever link is current, which on a development client is
        // the launcher's own URL long before the provider redirects. Committing to the
        // first non-null value would fail the sign-in against a URL that never carried
        // a result, so ignore anything that is not the callback.
        if (!isOAuthRedirectUrl(url) || !actOnce()) return;

        completeOAuthRedirect(url)
            // Claimed only once the exchange succeeds. Claiming earlier would gag the
            // sign-in screen even when this path is the one that ends up failing.
            .then(() => {
                if (claimOAuthNavigation()) return goOnward(userId);
            })
            .catch((error) => {
                // Backing out of the provider is a choice, not a fault worth reporting.
                if (!(error instanceof AuthError && error.code === 'CANCELLED')) {
                    reportError(error, 'OAuth redirect could not be completed');
                }

                router.replace('/sign-in');
            });
    }, [actOnce, goOnward, url, userId]);

    // `openAuthSessionAsync` may have completed the exchange itself, in which case a
    // session already exists and no redirect is coming.
    useEffect(() => {
        if (!userId) return;

        let active = true;

        getSession()
            .then(async (session) => {
                if (!active || !session || !actOnce()) return;
                if (!claimOAuthNavigation()) return;
                await goOnward(userId);
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [actOnce, goOnward, userId]);

    // Last resort, and deliberately not gated on `userId`: if the user row never
    // resolves there is nothing else left to fire, and a screen that renders only a
    // background would sit there indefinitely with no way out.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (actOnce()) router.replace('/sign-in');
        }, REDIRECT_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [actOnce]);

    return <Box style={styles.container} />;
};

export default AuthCallbackScreen;
