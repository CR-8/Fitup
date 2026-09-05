import { useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { useAuthRedirect } from '@/hooks/use-auth-redirect';
import { useUser } from '@/hooks/use-user';
import {
    AuthError,
    claimOAuthNavigation,
    completeOAuthRedirect,
    getSession,
    isOAuthRedirectUrl,
    redirectType,
} from '@/services/account';
import { resolveAuthDestination } from '@/services/auth-navigation';
import { clearAuthRedirect } from '@/services/auth-redirect';
import { beginPasswordRecovery, endPasswordRecovery } from '@/services/password-recovery';
import { reportError } from '@/services/error-reporting';

/**
 * Lands the OAuth redirect when Android delivers it as a deep link instead of letting
 * `openAuthSessionAsync` capture it. Without this route the URL resolves to nothing
 * and the tokens are lost behind the not-found screen.
 *
 * It is also where the two email links land — the sign-up confirmation and the
 * password reset — because Supabase sends all of them to one address and marks
 * them apart with `type` in the fragment. Only the reset is handled differently:
 * it arrives already signed in, and must not be allowed to end there.
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
    /**
     * From the root's capture, not this screen's own listener. A redirect into a
     * running app is delivered before this screen exists — it is what navigated
     * here — so asking for it here answered `null` and the tokens sat unused
     * until the timeout below gave up on them.
     */
    const url = useAuthRedirect();
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

    // Shared with the sign-in screen: either may land the redirect, and the two
    // must agree on where it goes.
    const goOnward = useCallback(async (): Promise<void> => {
        router.replace(await resolveAuthDestination());
    }, []);

    // The redirect itself, whenever it arrives.
    useEffect(() => {
        if (!userId || !url) return;

        // `useURL` reports whatever link is current, which on a development client is
        // the launcher's own URL long before the provider redirects. Committing to the
        // first non-null value would fail the sign-in against a URL that never carried
        // a result, so ignore anything that is not the callback.
        if (!isOAuthRedirectUrl(url) || !actOnce()) return;

        // Taken, so it cannot be replayed. The token is single-use: a second
        // attempt fails as "link expired", which is indistinguishable from a
        // link that never worked. The local `url` above is unaffected.
        clearAuthRedirect();

        const isRecovery = redirectType(url) === 'recovery';

        // Before the exchange, not after. `setSession` flips `isSignedIn`, and
        // `useFirstLaunchGate` acts on that in the same tick — if the flag is
        // not already set it sends the user to Home and this screen never gets
        // to redirect anywhere.
        if (isRecovery) beginPasswordRecovery();

        completeOAuthRedirect(url)
            // Claimed only once the exchange succeeds. Claiming earlier would gag the
            // sign-in screen even when this path is the one that ends up failing.
            .then(() => {
                // Ahead of the claim, and deliberately outside it. The claim
                // arbitrates between this screen and the sign-in screen over an
                // OAuth redirect, which either may land. A reset link reaches
                // only this screen — so a claim left standing by an earlier
                // provider sign-in would swallow the redirect here and leave the
                // flag set with the password unchanged.
                //
                // A reset link is a session, not a sign-in: it proves the person
                // reads that inbox, nothing more. Letting it land on Home would
                // leave the password they came to change still in place.
                if (isRecovery) return router.replace('/auth/new-password');

                if (claimOAuthNavigation()) return goOnward();
            })
            .catch((error) => {
                // Nothing to finish, so the flag must not outlive the attempt.
                if (isRecovery) endPasswordRecovery();

                const code = error instanceof AuthError ? error.code : null;

                // Backing out of the provider is a choice, and a link that has
                // expired is the ordinary fate of a link — neither is a fault.
                if (code !== 'CANCELLED' && code !== 'LINK_EXPIRED') {
                    reportError(error, 'OAuth redirect could not be completed');
                }

                // Expiry is the one failure worth explaining. Being returned to
                // sign-in with no word looks like the app simply lost the tap,
                // and the screen this one redirects to is the only place with
                // anywhere to say it.
                router.replace(
                    code === 'LINK_EXPIRED' ? '/sign-in?reason=linkExpired' : '/sign-in',
                );
            });
    }, [actOnce, goOnward, url, userId]);

    // `openAuthSessionAsync` may have completed the exchange itself, in which case a
    // session already exists and no redirect is coming.
    useEffect(() => {
        if (!userId) return;

        // Someone who was already signed in and then tapped a reset link arrives
        // here with a session this effect would happily accept — winning the race
        // against the effect above and landing them on Home, which is the exact
        // outcome the recovery branch exists to prevent. The URL is the only thing
        // that distinguishes the two, so it has to be consulted here too.
        if (url && redirectType(url) === 'recovery') return;

        let active = true;

        getSession()
            .then(async (session) => {
                if (!active || !session || !actOnce()) return;
                if (!claimOAuthNavigation()) return;
                await goOnward();
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [actOnce, goOnward, url, userId]);

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
