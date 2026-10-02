import { useTranslation } from 'react-i18next';

import { Stack } from '@/navigators/stack';

interface SearchHeaderProps {
    query: string;
    onQueryChange: (query: string) => void;
}

const SearchHeader = ({ onQueryChange }: SearchHeaderProps) => {
    const { t } = useTranslation(['common']);

    return (
        <Stack.Screen
            options={{
                headerSearchBarOptions: {
                    placeholder: t('placeholder.search', { ns: 'common' }),
                    onChangeText: (event) => onQueryChange(event.nativeEvent.text),
                },
            }}
        />
    );
};

export { SearchHeader };
