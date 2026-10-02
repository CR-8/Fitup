import { router } from 'expo-router';

import { FilterButton } from '@/components/buttons/filter';
import { useScreen } from '@/hooks/use-screen';
import { useFilterStore, hasActiveFilters } from '@/stores/filter';
import { useShallow } from 'zustand/shallow';

const useExercisesTab = () => {
    const { options } = useScreen();
    const filterState = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );

    const handleFilterOpen = () => {
        router.navigate('/filter');
    };

    return {
        name: 'exercises',
        options: {
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => (
                <FilterButton onPress={handleFilterOpen} active={hasActiveFilters(filterState)} />
            ),
        },
    };
};

export { useExercisesTab };
