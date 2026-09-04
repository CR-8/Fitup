import { AuthError } from '@/services/account';

/**
 * Which message to show for a failed auth call.
 *
 * Lived inside the sign-in screen while that was the only screen that could
 * fail. Four of them can now — sign-in, forgot password, check your email and
 * new password — and they have to agree, because the same `AuthError` reaches
 * more than one of them: a rate limit is hit from both resend buttons, and an
 * expired link is reported on the screen the callback bounced to.
 *
 * Keys are relative to the `screens` namespace and all live under `signIn.errors`
 * so the strings stay in one block rather than being duplicated per screen.
 */
export const errorKey = (error: unknown): string => {
    if (error instanceof AuthError) {
        switch (error.code) {
            case 'INVALID_CREDENTIALS':
                return 'signIn.errors.invalidCredentials';
            case 'EMAIL_IN_USE':
                return 'signIn.errors.emailInUse';
            case 'WEAK_PASSWORD':
                return 'signIn.errors.weakPassword';
            case 'EMAIL_NOT_CONFIRMED':
                return 'signIn.errors.emailNotConfirmed';
            case 'LINK_EXPIRED':
                return 'signIn.errors.linkExpired';
            case 'RATE_LIMITED':
                return 'signIn.errors.rateLimited';
            case 'SAME_PASSWORD':
                return 'signIn.errors.samePassword';
            case 'NETWORK':
                return 'signIn.errors.network';
            case 'DISABLED':
            case 'UNSUPPORTED':
                return 'signIn.errors.unavailable';
            default:
                return 'signIn.errors.unknown';
        }
    }

    return 'signIn.errors.unknown';
};
