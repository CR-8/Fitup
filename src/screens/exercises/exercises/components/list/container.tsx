import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { ViewToken } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { PreviewThumbnail } from '@/components/layout/preview';

import { ExerciseList } from './index';
import { ExerciseListItemComponent } from '../card';
import {
    ExerciseCard,
    ExerciseListItem,
    createExerciseSearchIndex,
    filterGroupedExercisesByName,
    groupExercises,
    useDeleteExercise,
} from '@/hooks/use-exercises';
import { collapseGroupedExercises } from '@/helpers/exercise-search';
import { useCollapsedSections } from '../../hooks/use-collapsed-sections';
import { getExerciseLibrarySnapshot, type ExerciseListSelect } from '@/crud/exercise';
import { StickyHeaderState } from '../header';
import { isFitupExerciseUserId } from '@/constants/fitup';
import { useAnalytics } from '@/hooks/use-analytics';
import { exerciseDisplayName } from '@/helpers/exercise-name';
import {
    getExerciseLibraryProperties,
    getSearchRankBucket,
    getSearchScriptGroup,
} from '@/analytics';

type ModeBrowse = {
    mode: 'browse';
    onExercisePress?: (exerciseId: string) => void;
};

type ModeSelect = {
    mode: 'select';
    selected: string[];
    onToggle: (exerciseId: string) => void;
};

type BaseProps = {
    rawExercises: ExerciseListSelect[] | undefined;
    query: string;
    analyticsWorkoutId?: string;
    isLoading?: boolean;
    error?: unknown;
    extraData?: unknown;
    contentContainerStyle?: StyleProp<ViewStyle>;
    activeFilterCount?: number;
};

type ExercisesListContainerProps = BaseProps & (ModeBrowse | ModeSelect);

const styles = StyleSheet.create((theme) => ({
    previewThumbContainer: {
        marginLeft: theme.space(8),
    },
}));

const getListItemIdentity = (item: ExerciseListItem) => {
    if (item.type === 'exercise') {
        return `exercise:${item.exercise.id}`;
    }

    return `${item.type}:${item.name}`;
};

export const ExercisesListContainer: FC<ExercisesListContainerProps> = ({
    rawExercises,
    query,
    analyticsWorkoutId,
    isLoading,
    error,
    extraData,
    contentContainerStyle,
    activeFilterCount = 0,
    ...rest
}) => {
    const { i18n } = useTranslation();
    const { track } = useAnalytics();
    const [stickyHeaderState, setStickyHeaderState] = useState<StickyHeaderState>({});
    const lastTrackedSearchRef = useRef<string | null>(null);

    const deleteExercise = useDeleteExercise();

    const groupedData = useMemo<ExerciseListItem[]>(() => {
        if (!rawExercises) return [];
        return groupExercises(rawExercises);
    }, [rawExercises]);

    const exerciseSearchIndex = useMemo(() => {
        return createExerciseSearchIndex(groupedData);
    }, [groupedData]);

    const collapse = useCollapsedSections();

    const data = useMemo<ExerciseListItem[]>(() => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            return collapseGroupedExercises(groupedData, collapse.state);
        }

        // Searching overrides the arrangement on purpose: typing is a request to
        // see matches, and a match hidden inside a shut group looks like no match
        // at all. What was collapsed comes back when the query clears, because
        // the state itself was never touched.
        return filterGroupedExercisesByName(
            groupedData,
            trimmedQuery,
            exerciseSearchIndex,
            i18n.resolvedLanguage || i18n.language,
        );
    }, [
        collapse.state,
        exerciseSearchIndex,
        groupedData,
        i18n.language,
        i18n.resolvedLanguage,
        query,
    ]);

    const exerciseResults = useMemo(
        () => data.filter((item): item is ExerciseCard => item.type === 'exercise'),
        [data],
    );

    const searchContext = rest.mode === 'browse' ? 'library' : 'workout_select';

    useEffect(() => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            lastTrackedSearchRef.current = null;
            return;
        }
        if (isLoading || error) return;

        const signature = `${searchContext}:${trimmedQuery}:${exerciseResults.length}:${activeFilterCount}`;
        let cancelled = false;
        const timeout = setTimeout(() => {
            if (lastTrackedSearchRef.current === signature) return;
            void getExerciseLibrarySnapshot().then((exerciseLibrary) => {
                if (cancelled) return;
                if (lastTrackedSearchRef.current === signature) return;
                lastTrackedSearchRef.current = signature;
                track('exercise_search:completed', {
                    context: searchContext,
                    workoutId: analyticsWorkoutId,
                    queryLength: Array.from(trimmedQuery).length,
                    scriptGroup: getSearchScriptGroup(trimmedQuery),
                    resultCount: exerciseResults.length,
                    hasResults: exerciseResults.length > 0,
                    activeFilterCount,
                    ...getExerciseLibraryProperties(
                        exerciseLibrary?.exerciseLibraryTotalCount ?? null,
                        exerciseLibrary?.exerciseLibraryFitupCount ?? null,
                        exerciseLibrary?.exerciseLibraryUserCreatedCount ?? null,
                    ),
                });
            });
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [
        activeFilterCount,
        analyticsWorkoutId,
        error,
        exerciseResults.length,
        isLoading,
        query,
        searchContext,
        track,
    ]);

    const stickyLookup = useMemo(() => {
        const categoryByIndex: (string | undefined)[] = [];
        const muscleGroupByIndex: (string | undefined)[] = [];
        let currentCategory: string | undefined;
        let currentMuscleGroup: string | undefined;

        for (let i = 0; i < data.length; i += 1) {
            const item = data[i];
            if (item?.type === 'category') {
                currentCategory = item.name;
                currentMuscleGroup = undefined;
            } else if (item?.type === 'muscle-group') {
                currentMuscleGroup = item.name;
            }

            categoryByIndex[i] = currentCategory;
            muscleGroupByIndex[i] = currentMuscleGroup;
        }

        return { categoryByIndex, muscleGroupByIndex };
    }, [data]);

    const listRemountKey = useMemo(() => {
        const rawCount = rawExercises?.length ?? 0;
        return `${rawCount}:${data.map(getListItemIdentity).join('|')}`;
    }, [data, rawExercises?.length]);

    const handleDelete = useCallback(
        (exerciseId: string) => {
            deleteExercise.mutate(exerciseId);
        },
        [deleteExercise],
    );

    const mode = rest.mode;
    const selectedList = mode === 'select' ? rest.selected : undefined;
    const onToggle = mode === 'select' ? rest.onToggle : undefined;
    const onExercisePress = mode === 'browse' ? rest.onExercisePress : undefined;

    const trackSearchSelection = useCallback(
        (exerciseItem: ExerciseCard) => {
            if (!query.trim()) return;
            const rank = exerciseResults.findIndex(
                (candidate) => candidate.exercise.id === exerciseItem.exercise.id,
            );
            if (rank < 0) return;

            track('exercise_search:result_selected', {
                context: searchContext,
                workoutId: analyticsWorkoutId,
                rankBucket: getSearchRankBucket(rank + 1),
                ownership: isFitupExerciseUserId(exerciseItem.exercise.userId)
                    ? 'system'
                    : 'custom',
                category: exerciseItem.exercise.category,
            });
        },
        [analyticsWorkoutId, exerciseResults, query, searchContext, track],
    );

    const trackWorkoutSelection = useCallback(
        (exerciseItem: ExerciseCard, selectedCount: number) => {
            if (!analyticsWorkoutId) return;

            track('workout:exercise_selected', {
                workoutId: analyticsWorkoutId,
                exerciseId: exerciseItem.exercise.id,
                discoveryMethod: query.trim() ? 'search' : 'browse',
                ownership: isFitupExerciseUserId(exerciseItem.exercise.userId)
                    ? 'system'
                    : 'custom',
                category: exerciseItem.exercise.category,
                selectedCount,
                activeFilterCount,
            });
        },
        [activeFilterCount, analyticsWorkoutId, query, track],
    );

    const handleGifPreviewOpen = useCallback((name: string, gifFilename: string) => {
        router.navigate({
            pathname: '/preview',
            params: { name, gifFilename },
        });
    }, []);

    const renderGifAccessory = useCallback(
        (exerciseItem: ExerciseCard) => {
            return (
                <PreviewThumbnail
                    name={exerciseDisplayName(exerciseItem.exercise)}
                    gifFilename={exerciseItem.exercise.gifFilename}
                    onOpen={handleGifPreviewOpen}
                    analyticsSurface={mode === 'browse' ? 'exercise_library' : 'workout_select'}
                    analyticsWorkoutId={analyticsWorkoutId}
                    containerStyle={styles.previewThumbContainer}
                />
            );
        },
        [analyticsWorkoutId, handleGifPreviewOpen, mode],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: ExerciseListItem; index: number }) => {
            if (item.type !== 'exercise') {
                // While a query is running the list is force-expanded, so the
                // headers are labels rather than controls and get no handler.
                const searching = !!query.trim();

                const open =
                    item.type === 'category'
                        ? searching || collapse.isCategoryOpen(item.name)
                        : searching || collapse.isMuscleGroupOpen(item.category, item.name);

                const onToggleSection = searching
                    ? undefined
                    : item.type === 'category'
                      ? () => collapse.toggleCategory(item.name)
                      : () => collapse.toggleMuscleGroup(item.category, item.name);

                return (
                    <ExerciseListItemComponent
                        item={item}
                        index={index}
                        data={data}
                        sectionOpen={open}
                        onToggleSection={onToggleSection}
                    />
                );
            }

            if (mode === 'select' && selectedList && onToggle) {
                const canDelete = !isFitupExerciseUserId(item.exercise.userId);
                return (
                    <ExerciseListItemComponent
                        item={item}
                        index={index}
                        data={data}
                        onDelete={canDelete ? handleDelete : undefined}
                        selectable
                        selected={selectedList.includes(item.exercise.id)}
                        onSelectToggle={(exerciseId) => {
                            if (!selectedList.includes(exerciseId)) {
                                trackSearchSelection(item);
                                trackWorkoutSelection(item, selectedList.length + 1);
                            }
                            onToggle(exerciseId);
                        }}
                        selectionPosition="left"
                        renderRightAccessory={renderGifAccessory}
                    />
                );
            }

            if (mode === 'browse') {
                const canDelete = !isFitupExerciseUserId(item.exercise.userId);
                return (
                    <ExerciseListItemComponent
                        item={item}
                        index={index}
                        data={data}
                        onDelete={canDelete ? handleDelete : undefined}
                        onPress={() => {
                            trackSearchSelection(item);
                            onExercisePress?.(item.exercise.id);
                        }}
                        renderRightAccessory={renderGifAccessory}
                    />
                );
            }

            return <></>;
        },
        [
            collapse,
            data,
            handleDelete,
            mode,
            onExercisePress,
            onToggle,
            query,
            renderGifAccessory,
            selectedList,
            trackSearchSelection,
            trackWorkoutSelection,
        ],
    );

    const getItemType = useCallback((item: ExerciseListItem) => item.type, []);

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken<ExerciseListItem>[] }) => {
            if (viewableItems.length === 0 || data.length === 0) {
                setStickyHeaderState((prev) =>
                    prev.category || prev.muscleGroup
                        ? { category: undefined, muscleGroup: undefined }
                        : prev,
                );
                return;
            }

            const firstVisibleIndex = Math.max(
                0,
                Math.min(viewableItems[0].index || 0, data.length - 1),
            );
            const category = stickyLookup.categoryByIndex[firstVisibleIndex];
            const muscleGroup = stickyLookup.muscleGroupByIndex[firstVisibleIndex];

            setStickyHeaderState((prev) =>
                prev.category === category && prev.muscleGroup === muscleGroup
                    ? prev
                    : { category, muscleGroup },
            );
        },
        [data, stickyLookup],
    );

    return (
        // Remount FlashList when the displayed rows change. Its internal
        // viewability/layout state can otherwise keep stale indices after
        // search or sync updates and crash before our viewability callback runs.
        <ExerciseList
            key={listRemountKey}
            data={data}
            renderItem={renderItem}
            getItemType={getItemType}
            onViewableItemsChanged={onViewableItemsChanged}
            stickyHeaderState={stickyHeaderState}
            extraData={extraData}
            isLoading={isLoading}
            error={error}
            contentContainerStyle={contentContainerStyle}
        />
    );
};
