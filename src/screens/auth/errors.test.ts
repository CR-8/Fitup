import { describe, expect, jest, test, beforeEach } from '@jest/globals';

/**
 * Guards which auth failures are treated as faults.
 *
 * The five auth screens each catch, report, and then alert. Reporting is
 * `console.error` in development and `Sentry.captureException` in production,
 * and neither is the right response to someone mistyping a password — every
 * code below already has a message written for it, which is the definition of
 * an outcome that was expected.
 *
 * `EMAIL_IN_USE` is the one that prompted this: it is raised by the app itself,
 * on purpose, so that a sign-up for an address Supabase will not send mail to
 * says so instead of routing to a check-your-email screen. It arrived as a red
 * LogBox toast reading `ERROR Email sign-in failed [AuthError: EMAIL_IN_USE]`,
 * which is a crash report for the feature working.
 *
 * A regression here is silent unless someone is watching the console during a
 * failed sign-in, which is why it is pinned rather than left to review.
 */

// `mock`-prefixed because jest hoists the factory above this declaration.
const mockReportError = jest.fn();

jest.mock('@/services/error-reporting', () => ({ reportError: mockReportError }));

/**
 * `@/services/account` reaches the native Supabase client and the expo-constants
 * manifest on import. Only the `AuthError` class is under test here, so both are
 * stubbed the same way `account.email.test.ts` stubs them.
 */
jest.mock('@/services/supabase', () => ({ supabase: {}, requireSupabase: () => ({}) }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'fitup://auth/callback' }));
jest.mock('@/constants/auth', () => ({
    AUTH_CONFIG: { googleEnabled: true },
    isAuthConfigured: () => true,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuthError } = require('@/services/account');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { errorKey, reportUnexpected } = require('@/screens/auth/errors');

beforeEach(() => {
    mockReportError.mockClear();
});

describe('failures that are just what happened', () => {
    // Every code that has a message on `errorKey`'s expected side. Listed rather
    // than derived, so that a code moved from one side to the other has to be
    // moved here too.
    const EXPECTED = [
        'CANCELLED',
        'INVALID_CREDENTIALS',
        'EMAIL_IN_USE',
        'WEAK_PASSWORD',
        'EMAIL_NOT_CONFIRMED',
        'LINK_EXPIRED',
        'RATE_LIMITED',
        'SAME_PASSWORD',
        'NETWORK',
    ];

    test.each(EXPECTED)('%s is not reported', (code) => {
        reportUnexpected(new AuthError(code), 'Email sign-in failed');

        expect(mockReportError).not.toHaveBeenCalled();
    });

    test('the person is still told — suppressing the report is not suppressing the message', () => {
        expect(errorKey(new AuthError('EMAIL_IN_USE'))).toBe('signIn.errors.emailInUse');
    });
});

describe('failures that mean something is broken', () => {
    // Nobody reaches these by using the form wrong: they need a missing
    // Supabase URL, a provider the build cannot do, or a message the classifier
    // did not recognise.
    test.each(['DISABLED', 'UNSUPPORTED', 'UNKNOWN'])('%s is reported', (code) => {
        reportUnexpected(new AuthError(code), 'Email sign-in failed');

        expect(mockReportError).toHaveBeenCalledTimes(1);
    });

    test('anything that is not an AuthError is reported', () => {
        reportUnexpected(new TypeError('undefined is not an object'), 'Email sign-in failed');

        expect(mockReportError).toHaveBeenCalledTimes(1);
    });
});
