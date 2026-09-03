import { storage } from '@/storage';

/**
 * Which local user row this device is currently acting as.
 *
 * The app used to have exactly one: `getCurrentUser()` read the first row in
 * the table and that was the user, whoever was signed in. On one device with
 * one account that is invisible; sign in with a second account and you inherit
 * the first one's name, weight, history and workouts.
 *
 * So the row is chosen by account now, and this is the pointer to it.
 *
 * It deliberately survives signing out. It is not a credential — sign-out
 * clears the Supabase session and the sync token, and the root layout drops
 * every app route, which is what makes the logout complete. Clearing this as
 * well would mean `useUser`'s init effect, which runs above `AccountProvider`
 * and therefore before the session is known, could find no row and mint a fresh
 * anonymous one on every signed-out launch.
 */

const ACTIVE_USER_ID_KEY = 'user.activeId';

export const getActiveUserId = (): string | null => {
    try {
        return storage.getString(ACTIVE_USER_ID_KEY) ?? null;
    } catch {
        return null;
    }
};

export const setActiveUserId = (userId: string): void => {
    try {
        storage.set(ACTIVE_USER_ID_KEY, userId);
    } catch {
        // A failed write costs this launch its account scoping, never a crash;
        // the next sign-in resolves the row again from the account.
    }
};

export const clearActiveUserId = (): void => {
    try {
        storage.remove(ACTIVE_USER_ID_KEY);
    } catch {
        // Best effort: see setActiveUserId.
    }
};
