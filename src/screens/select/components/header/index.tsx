import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';
import { CreateButton } from '@/components/buttons/create';
import { FilterButton } from '@/components/buttons/filter';

interface HeaderProps {
    title: string;
    isMergeMode: boolean;
    filterActive: boolean;
    query: string;
    onQueryChange: (query: string) => void;
    onCancel: () => void;
    onFilterOpen: () => void;
    onCreate: () => void;
}

const styles = StyleSheet.create((theme) => ({
    headerActions: {
        alignItems: 'center',
        gap: theme.space(3),
    },
}));

const Header = ({
    title,
    isMergeMode,
    filterActive,
    onQueryChange,
    onCancel,
    onFilterOpen,
    onCreate,
}: HeaderProps) => {
    const { t } = useTranslation(['common']);

    return (
        <Stack.Screen
            options={{
                title,
                headerLeft: () => (
                    <HeaderTextButton title={t('cancel', { ns: 'common' })} onPress={onCancel} />
                ),
                headerRight: () => (
                    <HStack style={styles.headerActions}>
                        <FilterButton onPress={onFilterOpen} active={filterActive} />
                        {!isMergeMode && <CreateButton onPressHandler={onCreate} />}
                    </HStack>
                ),
                headerSearchBarOptions: {
                    placeholder: t('placeholder.search', { ns: 'common' }),
                    hideWhenScrolling: false,
                    onChangeText: (event) => onQueryChange(event.nativeEvent.text),
                },
            }}
        />
    );
};

export { Header };
