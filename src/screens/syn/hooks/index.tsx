import { useTranslation } from 'react-i18next';

import { SummaryButton } from '@/components/buttons/summary';

/** Syn's native bar: its title, and the way back to Summary now there is no tab bar. */
export const useSynTab = () => {
    const { t } = useTranslation(['screens']);

    return {
        name: 'syn',
        options: { title: t('syn.title'), headerLeft: () => <SummaryButton /> },
    };
};
