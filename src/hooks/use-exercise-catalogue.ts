import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { ensureExerciseCatalogue } from '@/services/exercise-catalogue';
import { runInBackground } from '@/services/error-reporting';

/**
 * Every query whose rows carry an exercise name.
 *
 * A catalogue refresh rewrites `exercise.name` in SQLite for all 1,324
 * catalogue rows, but React Query has no way to know that: nothing went through
 * a mutation, so every cached list keeps the names it read in the old language.
 * The detail screen appeared to work only because it mounts fresh on each
 * navigation and refetches; the library list stays mounted on its tab and never
 * did, so it kept showing the previous language indefinitely.
 */
const EXERCISE_NAME_QUERY_KEYS = [
    ['exercises-list'],
    ['exercise'],
    ['exercise-history'],
    ['workout-details'],
    ['workout-exercises-with-exercise'],
] as const;

/**
 * Fetches the exercise catalogue after migrations, and refetches it when the
 * interface language changes, since names and instruction text are served per
 * locale.
 *
 * A no-op within the refresh window in the same language, so this is safe to
 * mount for the lifetime of the app. It never throws: a device that cannot
 * reach the API keeps whatever catalogue it already has.
 */
export const useExerciseCatalogue = (): void => {
    const { i18n } = useTranslation();
    const queryClient = useQueryClient();
    const language = i18n.language;

    useEffect(() => {
        runInBackground(async () => {
            await ensureExerciseCatalogue(language);

            // Unconditional, rather than only when rows actually changed:
            // `ensureExerciseCatalogue` can also write part of a catalogue and
            // then fail, so "did it finish" is the wrong question to gate on.
            // Invalidating an inactive query only marks it stale — nothing
            // refetches until something mounts and asks — so the cost of doing
            // this on a launch that changed nothing is a few local reads.
            for (const queryKey of EXERCISE_NAME_QUERY_KEYS) {
                queryClient.invalidateQueries({ queryKey });
            }
        }, 'Failed to prepare the exercise catalogue:');
    }, [language, queryClient]);
};
