import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ensureExerciseCatalogue } from '@/services/exercise-catalogue';
import { runInBackground } from '@/services/error-reporting';

/**
 * Fetches the exercise catalogue after migrations, and refetches it when the
 * interface language changes, since instruction text is served per locale.
 *
 * A no-op within the refresh window in the same language, so this is safe to
 * mount for the lifetime of the app. It never throws: a device that cannot
 * reach the API keeps whatever catalogue it already has.
 */
export const useExerciseCatalogue = (): void => {
    const { i18n } = useTranslation();
    const language = i18n.language;

    useEffect(() => {
        runInBackground(
            () => ensureExerciseCatalogue(language),
            'Failed to prepare the exercise catalogue:',
        );
    }, [language]);
};
