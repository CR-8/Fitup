import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';
import { getSession } from '@/services/account';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import i18n from '@/locale/i18n';
import { normalizeLanguage } from '@/locale/constants';

/**
 * Tells the account's Supabase project where to reach this device.
 *
 * `epsToken` (the Expo push token) already exists on the local `user` row —
 * `use-notifications.tsx` has read it since push permissions were first
 * requested. It has just never been anywhere a server could see it: that
 * column is `deviceOnly` in `src/services/backup/tables.ts`, on purpose, so
 * account restore never carries one phone's token onto another. This writes
 * to `public.push_tokens` instead (`supabase/migrations/0006`), a table built
 * for exactly this and nothing else.
 *
 * A no-op with no account signed in — there is no `auth.uid()` for
 * `push_tokens`' row-level security to scope an anonymous device to, so
 * remote push is one of the small number of features (with Syn) that needs
 * an account. Local reminders and workout-timer notifications are unaffected
 * either way; only a nudge sent from `supabase/functions/push-nudge` needs
 * this to have succeeded.
 */
export const registerPushToken = async (expoPushToken: string): Promise<void> => {
    if (!supabase || !expoPushToken) return;

    try {
        const session = await getSession();
        if (!session) return;

        // The language the user actually reads the app in — which can differ
        // from the OS locale once someone has changed it in Settings — rather
        // than a second, independent read of the device's own locale that
        // could disagree with it.
        const locale = normalizeLanguage(i18n.language);

        await supabase.from('push_tokens').upsert(
            {
                // Only actually used on first insert — the conflict target
                // below means an existing row keeps its own id and only
                // updates the columns listed.
                id: nanoid(),
                account_id: session.user.id,
                expo_push_token: expoPushToken,
                locale,
                platform: Platform.OS === 'ios' ? 'ios' : 'android',
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id,expo_push_token' },
        );
    } catch (error) {
        // Never blocks the rest of push registration — local notifications
        // and the app's own permission bookkeeping both work without this.
        reportError(error, 'Failed to register push token with Supabase:');
    }
};

/**
 * Removes this device's token on sign-out, so a nudge never reaches someone
 * who signed out specifically to stop hearing from the app on this phone.
 * Best-effort: RLS already means no other account's rows are ever touched by
 * this device, and a failed delete here leaves at worst one stale row for a
 * token that will fail silently once Expo's push service reports it invalid.
 */
export const unregisterPushToken = async (
    expoPushToken: string | null | undefined,
): Promise<void> => {
    if (!supabase || !expoPushToken) return;

    try {
        await supabase.from('push_tokens').delete().eq('expo_push_token', expoPushToken);
    } catch (error) {
        reportError(error, 'Failed to remove push token from Supabase:');
    }
};
