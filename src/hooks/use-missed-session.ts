import { useCallback } from 'react';

import { useEditor } from '@/hooks/use-editor';
import { useUpdateWorkout, useWorkout } from '@/hooks/use-workouts';
import { useMissedSessionStore } from '@/stores/missed-session';

export const MISSED_OPTIONS = ['today', 'tomorrow', 'chooseDay', 'skip'] as const;
export type MissedOption = (typeof MISSED_OPTIONS)[number];

/** `startAt` moved to `daysFromToday`, keeping its time of day (9:00 when it had none). */
const rescheduled = (startAt: Date | null | undefined, daysFromToday: number): Date => {
    const next = new Date();
    next.setDate(next.getDate() + daysFromToday);
    if (startAt) next.setHours(startAt.getHours(), startAt.getMinutes(), 0, 0);
    else next.setHours(9, 0, 0, 0);

    return next;
};

/**
 * What each choice on the missed-session sheet does. Every write goes through
 * `updateWorkout`, so it is queued for sync like any other edit. Skipping sets
 * `cancelled` rather than deleting, so the session stays in history.
 */
export const useMissedSession = () => {
    const workoutId = useMissedSessionStore((state) => state.workoutId);
    const close = useMissedSessionStore((state) => state.close);
    const { data: workout } = useWorkout(workoutId ?? '');
    const { mutateAsync: updateWorkout } = useUpdateWorkout();
    const { navigate } = useEditor();

    const choose = useCallback(
        async (option: MissedOption) => {
            if (!workoutId || !workout) return;
            close();

            if (option === 'today' || option === 'tomorrow') {
                await updateWorkout({
                    id: workoutId,
                    updates: { startAt: rescheduled(workout.startAt, option === 'today' ? 0 : 1) },
                });
            } else if (option === 'skip') {
                await updateWorkout({ id: workoutId, updates: { status: 'cancelled' } });
            } else {
                navigate({ type: 'workout__edit', payload: { workoutId } });
            }
        },
        [close, navigate, updateWorkout, workout, workoutId],
    );

    return { workoutId, workout, choose, close };
};
