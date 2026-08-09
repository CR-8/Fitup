import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ensureExerciseCatalogue } from '@/services/exercise-catalogue';
import { runInBackground } from '@/services/error-reporting';

/**
 * Seeds the bundled exercise catalogue after migrations, and refreshes its
 * instruction text when the interface language changes.
 *
 * Both operations are no-ops once the current version is seeded in the current
 * language, so this is safe to mount for the lifetime of the app.
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
