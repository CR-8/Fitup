/** The one inbox for problem reports, feedback and anything else users send. */
export const SUPPORT_EMAIL = 'gainfit.ai@gmail.com';

/**
 * Where a shared award, session or invite sends people to get the app. The
 * associated domain, so a phone that already has FitSyn opens it there.
 */
export const JOIN_URL = process.env.EXPO_PUBLIC_JOIN_URL || 'https://fitsyn.app';
