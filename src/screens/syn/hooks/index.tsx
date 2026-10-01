import { useTranslation } from 'react-i18next';

export const useSynTab = () => {
    const { t } = useTranslation(['screens']);

    return { name: 'syn', options: { title: t('syn.title') } };
};
