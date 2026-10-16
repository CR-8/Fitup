import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';

import { CreateButton } from '@/components/buttons/create';
import { FilterButton } from '@/components/buttons/filter';
import { SegmentedTabs } from '@/components/forms/segmented-tabs';
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';
import { useScreen } from '@/hooks/use-screen';
import { hasActiveFilters, useFilterStore } from '@/stores/filter';
import { usePlanSegmentStore } from '@/stores/plan-segment';

/**
 * The Plan tab: a transparent header carrying the Week / Library control, with
 * create (Week) or filter (Library) on the right.
 */
const useWorkoutHubTab = () => {
    const { t } = useTranslation(['screens']);
    const { options } = useScreen();
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
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
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
