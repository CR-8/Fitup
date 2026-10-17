import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { recordAward } from '@/crud/award';
import { logNotification } from '@/crud/notification-log';
import { runInBackground } from '@/services/error-reporting';
import { storage } from '@/storage';
import { useAwardText, useAwards } from '@/screens/awards/data';

import { useUser } from './use-user';
import { useTodayKey } from './use-water';

/** Set once the first pass has run: everything earned before then is recorded quietly. */
const BACKFILLED_KEY = 'awards.backfilled';

/**
 * How an award is acquired. Mounted for the life of the app, it watches every
 * award's figure (eaten, drunk, trained) and, the moment one meets its target
 * for the current period, records it in `award_earned` (backed up with the
 * account), puts it in Notifications with a link to the award, and taps a
 * success haptic.
 *
 * The first pass after install or upgrade records what was already earned
 * without announcing it, so nobody opens the app to a pile of old trophies.
 */
export const useAwardTracker = (): void => {
    const { t } = useTranslation(['screens']);
    const { user } = useUser();
    const today = useTodayKey();
    const { all, isReady } = useAwards(today);
    const text = useAwardText();
    const queryClient = useQueryClient();
    const recording = useRef(new Set<string>());
    const userId = user?.id;
    const haptics = user?.playHaptics !== false;

    useEffect(() => {
        if (!isReady || !userId) return;

        const quiet = !storage.getBoolean(BACKFILLED_KEY);
        const due = all.filter(
            (award) => award.due && !recording.current.has(award.id + award.period),
        );

        if (due.length === 0) {
            if (quiet) storage.set(BACKFILLED_KEY, true);
            return;
        }

        due.forEach((award) => recording.current.add(award.id + award.period));

        runInBackground(async () => {
            let announced = false;

            for (const award of due) {
                const row = await recordAward({
                    userId,
                    awardId: award.id,
                    period: award.period,
                    value: award.value,
                });
                if (!row || quiet) continue;

                announced = true;
                await logNotification({
                    userId,
                    kind: 'milestone',
                    title: t('awards.earnedTitle', { ns: 'screens', name: text.name(award) }),
                    body: text.description(award),
                    path: `/award/${award.id}`,
                });
            }

            storage.set(BACKFILLED_KEY, true);
            queryClient.invalidateQueries({ queryKey: ['awards-earned'] });
            queryClient.invalidateQueries({ queryKey: ['notification-log'] });

            if (announced && haptics) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        }, 'Failed to record earned awards:');
    }, [all, haptics, isReady, queryClient, t, text, userId]);
};
