import { AppState, type AppStateStatus } from 'react-native';

import { getCurrentUser, getUserByAccountId, resolveLocalUserForAccount } from '@/crud/user';
import { accountIdentityFromSession, getSession, type AccountIdentity } from '@/services/account';
import type { UserSelect } from '@/db/schema';
import { cleanupSyncedOperations } from '@/crud/sync';
import { queryClient } from '@/queries';
import { reportError, runInBackground } from '@/services/error-reporting';

import {
    isBackupEnabled,
    isBackupSchemaMissing,
    isMissingBackupSchema,
    noteBackupSchemaMissing,
} from './config';
import { pushBackup, pushEverything } from './push';
import { readBackupLocalUserId, restoreFromBackup } from './restore';
import { onPendingChange } from './pending';

export { isBackupEnabled } from './config';
export { pushBackup } from './push';
export { restoreFromBackup } from './restore';

/** Nothing in this path may turn a backup failure into a failed sign-in. */
const runQuietly = async <T>(work: Promise<T>, message: string): Promise<T | null> => {
    try {
        return await work;
    } catch (error) {
        reportError(error, message, { tags: { scope: 'backup' } });
        return null;
    }
};

/** How long the one blocking network call gets before it is given up on. */
const BACKUP_READ_TIMEOUT_MS = 10_000;

class BackupReadTimeout extends Error {
    constructor() {
        super('Timed out reading the account backup');
        this.name = 'BackupReadTimeout';
    }
}

/**
 * Supabase's fetch has no timeout of its own, and signing in now waits on this
 * call — both the launch gate and the post-sign-in navigation. Offline that is
 * a wait with no end, on the screen someone has just tapped a button on.
 */
const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new BackupReadTimeout()), ms);

        work.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });

/**
 * Restore, then push, then tell the app to re-read what changed.
 *
 * Detached on the path where the answer is already on the device, so signing in
 * costs a database read rather than a round trip. The invalidation at the end is
 * what makes a restored workout appear without another sign-in.
 */
type SettleMode =
    /** This account has never backed anything up: upload the lot. */
    | 'upload-everything'
    /** The device already knows this account: pull, then send what is newer. */
    | 'refresh'
    /** A restore has just been awaited; only the outbound half is left. */
    | 'push-only';

const settleBackup = async (userId: string, accountId: string, mode: SettleMode) => {
    if (mode === 'upload-everything') {
        // No change queue covers anything trained before this feature shipped,
        // so the first upload reads the tables directly.
        await runQuietly(pushEverything(userId, accountId), 'Failed to make the first backup:');
    } else if (mode === 'refresh') {
        await runQuietly(restoreFromBackup(), 'Failed to refresh from the account backup:');
    }

    await runQuietly(pushBackup(), 'Failed to back up to the account:');
    await queryClient.invalidateQueries();
};

/**
 * What happens when a session appears.
 *
 * The job is to answer one question — which local rows does this account own —
 * and it splits in two:
 *
 *   * a row already linked to this account, which is every sign-back-in on a
 *     device that has been used before. The answer is already here, so it is
 *     read locally and the backup settles behind it.
 *   * no linked row: a first sign-in, or a reinstall. The backup has to be
 *     consulted first, because it carries the local user id the backed-up
 *     workouts are keyed by, and rebuilding the row under any other id would
 *     orphan every one of them.
 *
 * Only the second case waits on the network, and only up to a limit. Nothing
 * here may turn a backup failure into a failed sign-in: people can still train.
 */
export const syncAccountBackup = async (identity: AccountIdentity): Promise<UserSelect> => {
    if (!isBackupEnabled() || isBackupSchemaMissing()) {
        return await resolveLocalUserForAccount(identity);
    }

    const linked = await getUserByAccountId(identity.accountId);

    if (linked) {
        const user = await resolveLocalUserForAccount(identity);

        runInBackground(
            settleBackup(user.id, identity.accountId, 'refresh'),
            'Failed to settle the account backup:',
        );

        return user;
    }

    let backupLocalUserId: string | null = null;
    let readable = true;

    try {
        backupLocalUserId = await withTimeout(readBackupLocalUserId(), BACKUP_READ_TIMEOUT_MS);
    } catch (error) {
        // Told apart from "this account has no backup", which looks identical
        // from here and means the opposite: one says upload everything, the
        // other says touch nothing until the network is back.
        readable = false;

        if (isMissingBackupSchema(error)) {
            noteBackupSchemaMissing();
            return await resolveLocalUserForAccount(identity);
        }

        reportError(error, 'Failed to read the account backup:', { tags: { scope: 'backup' } });
    }

    if (readable && backupLocalUserId !== null) {
        // Deliberately before the row is resolved: on a reinstall this is what
        // rebuilds the user row under the id the backed-up workouts already
        // point at, which `resolveLocalUserForAccount` then links rather than
        // creating a second row beside it.
        await runQuietly(restoreFromBackup(), 'Failed to restore from the account backup:');
    }

    const user = await resolveLocalUserForAccount(identity, backupLocalUserId ?? undefined);

    if (readable) {
        runInBackground(
            settleBackup(
                user.id,
                identity.accountId,
                // The restore above has already run when there was one to run.
                backupLocalUserId === null ? 'upload-everything' : 'push-only',
            ),
            'Failed to settle the account backup:',
        );
    }

    return user;
};

/**
 * The in-flight preparation for an account, so two callers get one run.
 *
 * Both the account provider and the sign-in navigation need the local user row
 * to have been resolved, and which of them arrives first is not fixed: the
 * provider reacts to the session, the sign-in screen already has it in hand.
 * Whoever asks first does the work; the other waits on the same promise.
 *
 * A module-level claim for the same reason `claimOAuthNavigation` is one — a
 * ref inside either caller is invisible to the other.
 */
let preparation: { accountId: string; work: Promise<UserSelect> } | null = null;

/**
 * Forgotten on sign-out, so signing back in restores and merges again rather
 * than replaying a decision made for a session that has since ended.
 */
export const forgetAccountPreparation = (): void => {
    preparation = null;
};

export const prepareAccount = (identity: AccountIdentity): Promise<UserSelect> => {
    if (preparation?.accountId === identity.accountId) return preparation.work;

    const work = syncAccountBackup(identity);

    // A failure must not be cached, or a sign-in that failed once on a dropped
    // connection would keep failing for the life of the process.
    preparation = {
        accountId: identity.accountId,
        work: work.catch((error) => {
            if (preparation?.work === work) preparation = null;
            throw error;
        }),
    };

    return preparation.work;
};

/**
 * The local user this session owns, preparing the account first if nobody has.
 *
 * This is what stops the moment after a sign-in from reading the previous
 * user's row — where a second account would briefly see the first one's
 * training, and be sent past onboarding on the strength of it.
 */
export const currentUserForSession = async (): Promise<UserSelect | null> => {
    const session = await getSession();

    if (!session) return await getCurrentUser();

    return await prepareAccount(accountIdentityFromSession(session));
};

/**
 * Long-stop only. A write announces itself, so this is what covers a change that
 * somehow never did — not the normal path.
 */
const PUSH_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Long enough for a save to finish arriving.
 *
 * A workout is not one write: the workout row, its groups, its exercises and
 * every set are queued in turn. Pushing on the first would send a workout with
 * no sets and then push again for each one.
 */
const PUSH_DEBOUNCE_MS = 3_000;

/**
 * Sends what is pending and waits for it.
 *
 * Signing out is the one moment this has to be awaited: it clears the session,
 * and without one there is nothing to push with — so anything still queued would
 * sit there until the next sign-in, which may well be a different account.
 */
const FLUSH_TIMEOUT_MS = 5_000;

export const flushBackup = async (): Promise<void> => {
    // Bounded: a backup that cannot reach the network must not hold someone in
    // an app they have asked to leave. What does not go now stays queued, and
    // goes up the next time this account is signed in.
    await runQuietly(
        withTimeout(pushBackup(), FLUSH_TIMEOUT_MS),
        'Failed to back up before signing out:',
    );
};

export const startBackupPushes = (): (() => void) => {
    if (!isBackupEnabled()) return () => undefined;

    let running = false;
    let pendingAgain = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const push = () => {
        if (running) {
            // A write landed mid-push and may not have been in the batch this
            // one read. Rather than skip it, go round once more when this ends.
            pendingAgain = true;
            return;
        }

        running = true;

        pushBackup()
            .then((complete) => (complete ? cleanupSyncedOperations() : 0))
            .catch((error) =>
                reportError(error, 'Failed to back up to the account:', {
                    tags: { scope: 'backup' },
                }),
            )
            .finally(() => {
                running = false;

                if (pendingAgain) {
                    pendingAgain = false;
                    push();
                }
            });
    };

    const pushSoon = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(push, PUSH_DEBOUNCE_MS);
    };

    const onAppStateChange = (state: AppStateStatus) => {
        if (state === 'active' || state === 'background') push();
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    const interval = setInterval(push, PUSH_INTERVAL_MS);
    const unsubscribe = onPendingChange(pushSoon);

    push();

    return () => {
        subscription.remove();
        clearInterval(interval);
        unsubscribe();
        if (debounce) clearTimeout(debounce);
    };
};
