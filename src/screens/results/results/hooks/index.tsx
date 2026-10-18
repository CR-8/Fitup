import { useTranslation } from 'react-i18next';

import { SummaryButton } from '@/components/buttons/summary';

/** Progress's native bar: its title, and the way back to Summary now there is no tab bar. */
export const useResultsTab = () => {
    const { t } = useTranslation(['screens']);

    return {
        name: 'results',
        options: { title: t('results.title'), headerLeft: () => <SummaryButton /> },
    };
};
