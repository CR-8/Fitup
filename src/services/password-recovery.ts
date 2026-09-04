import { storage } from '@/storage';

/**
 * Whether the session that is open was opened by a password-reset link.
 *
 * A recovery link is not a message — it is a full session. Supabase signs the
 * person in and trusts the app to insist on a new password before letting them
 * anywhere else. Nothing in the session says so, so this flag is the only
 * record of it.
 *
 * Read synchronously rather than held in React state, because the read races a
 * render: `useFirstLaunchGate` runs the moment `isSignedIn` flips true, and if
 * it does not already know a recovery is in progress it replaces the new
 * password screen with Home. Setting the flag before `setSession` and reading
 * it straight out of MMKV closes that window — the same reason
 * `src/services/account.ts` keeps its OAuth claim in module scope.
 *
 * Persisted, not in-memory, so force-quitting halfway does not strand someone
 * signed in to an account whose password they have just told us they forgot.
 * The next launch puts them back on the screen.
 *
 * Lives apart from `account.ts` deliberately: this is the only part of the auth
 * path that touches storage, and pulling MMKV into that module would drag a
 * native dependency into everything that imports it.
 */

const RECOVERY_PENDING_KEY = 'auth.recoveryPending';

export const beginPasswordRecovery = (): void => {
    try {
        storage.set(RECOVERY_PENDING_KEY, true);
    } catch {
        // Worst case the gate wins the race and lands them on Home, still
        // signed in. Settings → Change password is the way back.
    }
};

export const endPasswordRecovery = (): void => {
    try {
        storage.remove(RECOVERY_PENDING_KEY);
    } catch {
        // A flag that fails to clear traps the next launch on the password
        // screen, which is recoverable — that screen can sign out.
    }
};

export const isPasswordRecoveryPending = (): boolean => {
    try {
        return storage.getBoolean(RECOVERY_PENDING_KEY) ?? false;
    } catch {
        return false;
    }
};
