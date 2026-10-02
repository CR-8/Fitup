import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Button } from '@/components/buttons/base';
import { CreateButton } from '@/components/buttons/create';
import { FilterButton } from '@/components/buttons/filter';
import { Search } from '@/screens/exercises/exercises/components/search';

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
    header: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(3),
        paddingBottom: theme.space(2),
        backgroundColor: theme.colors.background,
        gap: theme.space(2),
    },
    headerContentContainer: {
        paddingBottom: theme.space(2),
        justifyContent: 'space-between',
    },
    headerLeftContentContainer: {
        flex: 1,
        alignItems: 'flex-start',
    },
    headerRightContentContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: theme.space(2.5),
    },
    headerTitleContainer: {
        flexGrow: 1,
        alignItems: 'center',
    },
    createButton: {
        width: theme.space(6),
        height: theme.space(6),
        backgroundColor: theme.colors.background,
    },
    filterButton: {
        paddingTop: theme.space(0),
    },
    filterDot: {
        right: 0,
    },
}));

const Header = ({
    title,
    isMergeMode,
    filterActive,
    query,
    onQueryChange,
    onCancel,
    onFilterOpen,
    onCreate,
}: HeaderProps) => {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();

    return (
        <Box style={styles.header}>
            <HStack style={styles.headerContentContainer}>
                <Box style={styles.headerLeftContentContainer}>
                    <Button type="link" title={t('cancel', { ns: 'common' })} onPress={onCancel} />
                </Box>
                <Box style={styles.headerTitleContainer}>
                    <Text fontWeight="bold">{title}</Text>
                </Box>
                <HStack style={styles.headerRightContentContainer}>
                    <FilterButton
                        onPress={onFilterOpen}
                        active={filterActive}
                        containerStyle={[styles.createButton, styles.filterButton]}
                        dotStyle={styles.filterDot}
                        iconColor={theme.solid.typography}
                        iconSize={theme.space(5)}
                    />
                    {!isMergeMode && (
                        <CreateButton
                            onPressHandler={onCreate}
                            containerStyle={styles.createButton}
                            iconColor={theme.solid.typography}
                            iconSize={theme.space(6)}
                        />
                    )}
                </HStack>
            </HStack>
            <Search
                value={query}
                onChange={onQueryChange}
                placeholder={t('placeholder.search', { ns: 'common' })}
                dismissText={t('done', { ns: 'common' })}
            />
        </Box>
    );
};

export { Header };
