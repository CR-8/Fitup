import { useTranslation } from 'react-i18next';

/** No navigation bar: Syn draws its own header, as Today does (`components/header`). */
export const useSynTab = () => {
    const { t } = useTranslation(['screens']);

    return { name: 'syn', options: { title: t('syn.title'), headerShown: false } };
};
