import {
    createContext,
    type FC,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { isAuthConfigured } from '@/constants/auth';
import {
    accountIdentityFromSession,
    getSession,
    onAuthStateChange,
    signOut as signOutOfAccount,
} from '@/services/account';
import { forgetAccountPreparation, prepareAccount, startBackupPushes } from '@/services/backup';
import { queryClient } from '@/queries';
import { runInBackground } from '@/services/error-reporting';

interface AccountContextValue {
    /** Null while signed out, which is a fully supported state. */
    session: Session | null;
    isSignedIn: boolean;
    /** False until the stored session has been read, to avoid a sign-in flash. */
    isReady: boolean;
    /**
     * False until the local user row this session owns has been decided.
     *
     * Distinct from `isReady`, which only says the session has been read.
     * Anything that creates or reads the local user has to wait for this one, or
     * it races the resolver and both create a row.
     */
    isPrepared: boolean;
    signOut: () => Promise<void>;
}

const accountContext = createContext<AccountContextValue | null>(null);

export const AccountProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    // A build without accounts is ready immediately; there is nothing to restore.
    const [isReady, setIsReady] = useState(!isAuthConfigured());
    const [preparedAccountId, setPreparedAccountId] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthConfigured()) return;

        let active = true;

        getSession()
            .then((restored) => {
                if (!active) return;
                setSession(restored);
            })
            .finally(() => {
                if (active) setIsReady(true);
            });

        const unsubscribe = onAuthStateChange((next) => {
            if (active) setSession(next);
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    /**
     * Decides which local rows this session owns, and settles the backup.
     *
     * This used to be a one-line mirror of the account id onto whatever local
     * row happened to be first in the table. That is why a second account
     * inherited the first one's training: there was only ever one row, and
     * signing in relabelled it. `syncAccountBackup` resolves the row from the
     * account instead, restoring it from the backup when the device has never
     * seen this account before.
     *
     * Which account has been through that is state rather than a ref, because
     * the rest of the app has to wait on it — `useUser` must not create a local
     * row while this is still deciding which row already exists.
     */
    useEffect(() => {
        const accountId = session?.user.id;

        if (!accountId || preparedAccountId === accountId) return;

        runInBackground(async () => {
            try {
                // Shared with the sign-in navigation, which needs the same
                // answer and may well ask for it first. Whoever arrives first
                // does the work; `prepareAccount` collapses the rest.
                await prepareAccount(accountIdentityFromSession(session));

                // The active local user has just been decided, so every cached
                // query — the user row, the workout list, whether onboarding is
                // done — was answered for a different user or for none.
                await queryClient.invalidateQueries();
            } finally {
                // Marked even on failure. Holding it back would leave the app on
                // the splash screen forever, waiting for a row nothing will
                // create.
                setPreparedAccountId(accountId);
            }
        }, 'Failed to prepare the account:');
    }, [preparedAccountId, session]);

    // Signed out there is nothing to resolve: the local user is whatever this
    // device already has, so reading the stored session is the whole wait.
    const isPrepared = session === null ? isReady : preparedAccountId === session.user.id;

    /** Runs for the life of the provider; it no-ops until there is a session. */
    useEffect(() => startBackupPushes(), []);

    const signOut = useCallback(async () => {
        await signOutOfAccount();

        // Both cleared so signing back into the same account restores and merges
        // again, rather than replaying a decision made for a session that has
        // since ended.
        forgetAccountPreparation();
        setPreparedAccountId(null);
        setSession(null);
    }, []);

    const value = useMemo<AccountContextValue>(
        () => ({ session, isSignedIn: session !== null, isReady, isPrepared, signOut }),
        [isPrepared, isReady, session, signOut],
    );

    return <accountContext.Provider value={value}>{children}</accountContext.Provider>;
};

export const useAccount = (): AccountContextValue => {
    const context = useContext(accountContext);

    if (!context) {
        throw new Error('useAccount must be used within an AccountProvider');
    }

    return context;
};
