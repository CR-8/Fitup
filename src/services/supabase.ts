import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { AUTH_CONFIG, isAuthConfigured } from '@/constants/auth';
import { storage } from '@/storage';

/**
 * Supabase client, created only when the build is configured for accounts.
 *
 * Sessions persist through MMKV rather than AsyncStorage so token storage uses
 * the same mechanism as the rest of the app's persisted state.
 */

const mmkvStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return storage.getString(key) ?? null;
        } catch {
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            storage.set(key, value);
        } catch {
            // A failed write costs the user a re-login, never a crash.
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            storage.remove(key);
        } catch {
            // Same rationale as setItem.
        }
    },
};

const createSupabaseClient = (): SupabaseClient | null => {
    if (!isAuthConfigured()) return null;

    return createClient(AUTH_CONFIG.supabaseUrl!, AUTH_CONFIG.supabaseAnonKey!, {
        auth: {
            storage: mmkvStorageAdapter,
            autoRefreshToken: true,
            persistSession: true,
            // There is no browser URL to read a session back from on a device;
            // the OAuth callback is handled explicitly by the auth service.
            detectSessionInUrl: false,
        },
    });
};

export const supabase = createSupabaseClient();

/**
 * Narrowing helper for the many call sites that only run when accounts are on.
 * Throwing here rather than returning null keeps those call sites readable.
 */
export const requireSupabase = (): SupabaseClient => {
    if (!supabase) {
        throw new Error('Supabase is not configured for this build');
    }

    return supabase;
};
