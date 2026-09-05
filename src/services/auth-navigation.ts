import type { Href } from 'expo-router';

import { hasCompletedOnboarding } from '@/crud/onboarding';
import { consumeOAuthReturnTo } from '@/services/account';
import { currentUserForSession } from '@/services/backup';

/**
 * Where a completed sign-in should send the user.
 *
 * Both the sign-in screen and the OAuth callback screen finish a sign-in, and
 * before this they each carried their own copy of this decision. Two copies of a
 * routing rule drift, and the drift only shows up as landing on the wrong screen
 * after a flow that is awkward to reproduce.
 */

/**
 * Only in-app paths are honoured.
 *
 * The destination can be set from a search param, which reaches the app through
 * a deep link. Without this, `fitup:///sign-in?returnTo=https://…` would let an
 * external link choose where the app goes after a successful sign-in.
 */
const isInternalPath = (path: string): boolean => path.startsWith('/') && !path.startsWith('//');

export const resolveAuthDestination = async (): Promise<Href> => {
    const returnTo = consumeOAuthReturnTo();

    if (returnTo && isInternalPath(returnTo)) return returnTo as Href;

    // Deliberately not the user id the calling screen is holding. That one was
    // read before the sign-in and belongs to whoever was here last — which for
    // a second account on the same phone means being waved past onboarding on
    // the strength of the previous person's answers.
    const user = await currentUserForSession();

    // First-launch rules: someone who has already answered the onboarding
    // questions is returning, not starting, so they go straight to training.
    const onboarded = user ? await hasCompletedOnboarding(user.id) : false;

    return onboarded ? '/' : '/onboarding';
};
