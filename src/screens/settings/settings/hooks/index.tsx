import { useTranslation } from 'react-i18next';

export const useYouTab = () => {
    const { t } = useTranslation(['screens']);

    return { name: 'you', options: { title: t('you.title') } };
};
