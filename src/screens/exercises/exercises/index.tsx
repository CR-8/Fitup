import { FC, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import {
    useExercisesList,
    useFavoriteExerciseIds,
    useRecentlyUsedExerciseIds,
} from '@/hooks/use-exercises';
import { countActiveFilters, useFilterStore } from '@/stores/filter';
import { useShallow } from 'zustand/shallow';

import { Search } from './components/search';
import { Shelf } from './components/shelf';
import { ExercisesListContainer } from './components/list/container';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingTop: theme.screenContentPadding('root').paddingTop,
    },
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
    listContainer: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: theme.screenContentPadding('root').paddingBottom,
    },
}));

const Exercises: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const { ownership, category, tracking, primaryMuscle } = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );

    const filters = useMemo(
        () => ({ ownership, category, tracking, primaryMuscle }),
        [ownership, category, tracking, primaryMuscle],
    );
    const activeFilterCount = countActiveFilters(filters);

    const { data: rawExercises, isLoading, isFetching, error } = useExercisesList(filters);
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);

    const handleExercisePress = useCallback((exerciseId: string) => {
        router.navigate(`/exercises/${exerciseId}`);
    }, []);

    const favoriteIds = useFavoriteExerciseIds();
    const recentIds = useRecentlyUsedExerciseIds();

    // Mapped onto rows already loaded for the list, so neither shelf reads the
    // exercise table a second time. An id with no row — an exercise since
    // deleted, or filtered out — simply drops out.
    const shelves = useMemo(() => {
        if (deferredQuery.trim() || !rawExercises) return null;

        const byId = new Map(rawExercises.map((exercise) => [exercise.id, exercise]));
        const pick = (ids: Iterable<string>) =>
            [...ids].map((id) => byId.get(id)).filter((row) => row !== undefined);

        const favorites = pick(favoriteIds);
        const recent = pick(recentIds);

        if (favorites.length === 0 && recent.length === 0) return null;

        return (
            <>
                <Shelf
                    title={t('exercises.favorites', { ns: 'screens' })}
                    exercises={favorites}
                    onPress={handleExercisePress}
                />
                <Shelf
                    title={t('exercises.recentlyUsed', { ns: 'screens' })}
                    exercises={recent}
                    onPress={handleExercisePress}
                />
            </>
        );
    }, [deferredQuery, favoriteIds, handleExercisePress, rawExercises, recentIds, t]);

    return (
        <Box style={styles.container}>
            <Box style={styles.header}>
                <Title type="h1">{t('exercises.title', { ns: 'screens' })}</Title>
                <Text style={styles.subtitle}>{t('exercises.subtitle', { ns: 'screens' })}</Text>
                <Search
                    value={query}
                    onChange={setQuery}
                    placeholder={t('placeholder.search', { ns: 'common' })}
                    dismissText={t('done', { ns: 'common' })}
                />
            </Box>
            <ExercisesListContainer
                mode="browse"
                rawExercises={rawExercises}
                query={deferredQuery}
                activeFilterCount={activeFilterCount}
                isLoading={isLoading || isFetching}
                error={error}
                onExercisePress={handleExercisePress}
                contentContainerStyle={styles.contentContainer}
                header={shelves}
            />
        </Box>
    );
};

export default Exercises;
