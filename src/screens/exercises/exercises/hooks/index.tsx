import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';

import { FilterButton } from '@/components/buttons/filter';
import { useFilterStore, hasActiveFilters } from '@/stores/filter';

const useExercisesTab = () => {
    const { t } = useTranslation(['screens']);
    const filterState = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );

    return {
        name: 'exercises',
        options: {
            title: t('exercises.title'),
            headerRight: () => (
                <FilterButton
                    onPress={() => router.navigate('/filter')}
                    active={hasActiveFilters(filterState)}
                />
            ),
        },
    };
};

export { useExercisesTab };
