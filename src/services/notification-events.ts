import i18n from '@/locale/i18n';
import { getProfile } from '@/crud/ai';
import { logNotification } from '@/crud/notification-log';
import { getWorkouts } from '@/crud/workout';
import { countThisWeek } from '@/helpers/workouts';
import { queryClient } from '@/queries';

/**
 * The few things worth putting in the Notifications list. Each writes a row and
 * tells the list and the bell to refresh. None can throw: `logNotification`
 * swallows and reports its own failures.
 */

const DEFAULT_WEEKLY_TARGET = 3;

const refresh = () => queryClient.invalidateQueries({ queryKey: ['notification-log'] });

/** A plan was added to, or taken back off, the schedule. */
export const logPlanUpdated = async (userId: string, undone = false): Promise<void> => {
    await logNotification({
        userId,
        kind: 'plan',
        title: i18n.t(undone ? 'inbox.planUndone.title' : 'inbox.planUpdated.title', {
            ns: 'screens',
        }),
        body: i18n.t(undone ? 'inbox.planUndone.body' : 'inbox.planUpdated.body', {
            ns: 'screens',
        }),
        path: '/workouts',
    });
    refresh();
};

/** Logged the moment a finished workout brings the week to its target, and only then. */
export const logWeeklyMilestoneIfReached = async (userId: string): Promise<void> => {
    const [workouts, profile] = await Promise.all([getWorkouts(), getProfile(userId)]);
    const target = profile?.sessionsPerWeek || DEFAULT_WEEKLY_TARGET;
    const done = countThisWeek(workouts);

    if (done !== target) return;

    await logNotification({
        userId,
        kind: 'milestone',
        title: i18n.t('inbox.milestone.title', { ns: 'screens' }),
        body: i18n.t('inbox.milestone.body', { ns: 'screens', done, target }),
        path: '/results',
    });
    refresh();
};

/** A push the person was shown (not one of the app's own timer notifications). */
export const logReceivedNotification = async (
    userId: string,
    content: { title?: string | null; body?: string | null; data?: Record<string, unknown> },
): Promise<void> => {
    // Timer notifications carry a `kind`; they are not news worth keeping.
    if (!content.title || content.data?.kind) return;

    const url = typeof content.data?.url === 'string' ? content.data.url : null;

    await logNotification({
        userId,
        kind: 'reminder',
        title: content.title,
        body: content.body ?? null,
        path: url?.replace(/^[a-z]+:\/\/\/?/i, '/') ?? null,
    });
    refresh();
};
