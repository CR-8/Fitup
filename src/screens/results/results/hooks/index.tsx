import { useTranslation } from 'react-i18next';

export const useResultsTab = () => {
    const { t } = useTranslation(['screens']);

    return { name: 'results', options: { title: t('results.title') } };
};
