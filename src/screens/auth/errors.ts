import { AuthError, type AuthFailureCode } from '@/services/account';
import { reportError } from '@/services/error-reporting';

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

/**
 * Whether a failure is worth a report, or is just what happened.
 *
 * Every code above has a message written for it, which is the point: a wrong
 * password and an address that is already taken are ordinary outcomes of using
 * the form, not faults. Reporting them made the red LogBox toast part of the
 * normal sign-in experience, and would have filled Sentry with other people's
 * typos — `EMAIL_IN_USE` in particular is raised deliberately, by us, so the
 * screen can say "that address already has an account".
 *
 * A `Record` rather than a `Set` so that adding a code to `AuthFailureCode`
 * fails the typecheck until someone decides which kind it is.
 */
const DISPOSITION: Record<AuthFailureCode, 'expected' | 'report'> = {
    CANCELLED: 'expected',
    INVALID_CREDENTIALS: 'expected',
    EMAIL_IN_USE: 'expected',
    WEAK_PASSWORD: 'expected',
    EMAIL_NOT_CONFIRMED: 'expected',
    LINK_EXPIRED: 'expected',
    RATE_LIMITED: 'expected',
    SAME_PASSWORD: 'expected',
    NETWORK: 'expected',
    // Misconfiguration rather than user error: nobody reaches these unless
    // something about the build or the project is wrong.
    DISABLED: 'report',
    UNSUPPORTED: 'report',
    UNKNOWN: 'report',
};

/**
 * `reportError`, minus the failures that were always going to happen.
 *
 * Anything that is not an `AuthError` still goes through — an unrecognised
 * throw is exactly the kind of thing worth hearing about.
 */
export const reportUnexpected = (error: unknown, context: string): void => {
    if (error instanceof AuthError && DISPOSITION[error.code] === 'expected') return;

    reportError(error, context);
};
