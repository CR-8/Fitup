import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CreateButton } from '@/components/buttons/create';
import { FilterButton } from '@/components/buttons/filter';
import { SegmentedTabs } from '@/components/forms/segmented-tabs';
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';
import { hasActiveFilters, useFilterStore } from '@/stores/filter';
import { usePlanSegmentStore } from '@/stores/plan-segment';
import { useShallow } from 'zustand/shallow';

/**
 * The Plan tab: the week's schedule and the exercise library behind one
 * Week / Library control in the header. The trailing button follows it: create
 * a workout on Week, filter on Library.
 */
const useWorkoutHubTab = () => {
    const { t } = useTranslation(['screens']);
    const { navigate } = useEditor();
    const { track } = useAnalytics();
    const { segment, setSegment } = usePlanSegmentStore();
    const filterState = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );

    const handleWorkoutCreate = () => {
        track('workout:create_requested', { surface: 'workout_tab_header' });
        navigate({ type: 'workout__create' });
    };

    return {
        name: 'workouts',
        options: {
            title: t('plan.title'),
            headerLargeTitle: false,
            headerTitle: () => (
                <SegmentedTabs
                    value={segment}
                    onChange={setSegment}
                    segments={[
                        { value: 'week', title: t('plan.week') },
                        { value: 'library', title: t('plan.library') },
                    ]}
                />
            ),
            headerRight: () =>
                segment === 'library' ? (
                    <FilterButton
                        onPress={() => router.navigate('/filter')}
                        active={hasActiveFilters(filterState)}
                    />
                ) : (
                    <CreateButton onPressHandler={handleWorkoutCreate} />
                ),
        },
    };
};

export { useWorkoutHubTab };
