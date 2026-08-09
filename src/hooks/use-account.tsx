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
    getSession,
    onAuthStateChange,
    signOut as signOutOfAccount,
    type AuthProvider,
} from '@/services/account';
import { updateUser } from '@/crud/user';
import { runInBackground } from '@/services/error-reporting';

import { useUser } from './use-user';

interface AccountContextValue {
    /** Null while signed out, which is a fully supported state. */
    session: Session | null;
    isSignedIn: boolean;
    /** False until the stored session has been read, to avoid a sign-in flash. */
    isReady: boolean;
    signOut: () => Promise<void>;
}

const accountContext = createContext<AccountContextValue | null>(null);

const resolveProvider = (session: Session | null): AuthProvider | null => {
    const provider = session?.user.app_metadata.provider;

    if (provider === 'google' || provider === 'apple') return provider;
    if (provider === 'email') return 'email';

    return null;
};

export const AccountProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useUser();
    const [session, setSession] = useState<Session | null>(null);
    // A build without accounts is ready immediately; there is nothing to restore.
    const [isReady, setIsReady] = useState(!isAuthConfigured());

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
     * Mirrors the account onto the local user row so the rest of the app can read
     * identity from one place. The local id never changes, so signing in adopts
     * the existing training history rather than starting a new one.
     */
    useEffect(() => {
        if (!user?.id) return;

        const accountId = session?.user.id ?? null;
        if (user.accountId === accountId) return;

        runInBackground(
            () =>
                updateUser(user.id, {
                    accountId,
                    accountEmail: session?.user.email ?? null,
                    accountProvider: resolveProvider(session),
                }),
            'Failed to link the account to the local user:',
        );
    }, [session, user?.accountId, user?.id]);

    const signOut = useCallback(async () => {
        await signOutOfAccount();
        setSession(null);
    }, []);

    const value = useMemo<AccountContextValue>(
        () => ({ session, isSignedIn: session !== null, isReady, signOut }),
        [isReady, session, signOut],
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
