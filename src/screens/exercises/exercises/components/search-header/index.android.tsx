import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';

import { Search } from '../search';

interface SearchHeaderProps {
    query: string;
    onQueryChange: (query: string) => void;
}

const styles = StyleSheet.create((theme) => ({
    header: {
        paddingHorizontal: theme.space(4),
        marginBottom: theme.space(3),
        backgroundColor: theme.colors.background,
        gap: theme.space(2),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

const SearchHeader = ({ query, onQueryChange }: SearchHeaderProps) => {
    const { t } = useTranslation(['common', 'screens']);

    return (
        <Box style={styles.header}>
            <Title type="h1">{t('exercises.title', { ns: 'screens' })}</Title>
            <Text style={styles.subtitle}>{t('exercises.subtitle', { ns: 'screens' })}</Text>
            <Search
                value={query}
                onChange={onQueryChange}
                placeholder={t('placeholder.search', { ns: 'common' })}
                dismissText={t('done', { ns: 'common' })}
            />
        </Box>
    );
};

export { SearchHeader };
