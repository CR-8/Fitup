import { useCallback, useState } from 'react';

import { muscleGroupKey, type ExerciseCollapseState } from '@/helpers/exercise-search';
import { storage } from '@/storage';

/**
 * Which parts of the library are shut, remembered between visits.
 *
 * Persisted because the collapse is how someone arranges a list of 1,324
 * exercises to suit themselves — opening two muscle groups they train and
 * having that thrown away on the walk to an exercise and back would make the
 * feature not worth using.
 *
 * The polarity of the two sets is deliberate and matches
 * `collapseGroupedExercises`: a category is open unless named, a muscle group
 * is shut unless named. That is what makes "everything closed" the default with
 * no extra state to seed.
 */

const KEYS = {
    collapsedCategories: 'exercises.collapsedCategories',
    expandedMuscleGroups: 'exercises.expandedMuscleGroups',
} as const;

const read = (key: string): Set<string> => {
    try {
        const stored = storage.getString(key);
        if (!stored) return new Set();

        const parsed: unknown = JSON.parse(stored);

        return Array.isArray(parsed)
            ? new Set(parsed.filter((v) => typeof v === 'string'))
            : new Set();
    } catch {
        // Unreadable or malformed: fall back to the defaults rather than
        // failing to render the library at all.
        return new Set();
    }
};

const write = (key: string, values: Set<string>): void => {
    try {
        storage.set(key, JSON.stringify([...values]));
    } catch {
        // The arrangement is a convenience; losing it costs a tap.
    }
};

const toggle = (values: Set<string>, value: string): Set<string> => {
    const next = new Set(values);

    if (!next.delete(value)) next.add(value);

    return next;
};

export interface ExerciseCollapse {
    state: ExerciseCollapseState;
    toggleCategory: (name: string) => void;
    toggleMuscleGroup: (category: string, name: string) => void;
    isCategoryOpen: (name: string) => boolean;
    isMuscleGroupOpen: (category: string, name: string) => boolean;
}

export const useCollapsedSections = (): ExerciseCollapse => {
    const [collapsedCategories, setCollapsedCategories] = useState(() =>
        read(KEYS.collapsedCategories),
    );
    const [expandedMuscleGroups, setExpandedMuscleGroups] = useState(() =>
        read(KEYS.expandedMuscleGroups),
    );

    const toggleCategory = useCallback((name: string) => {
        setCollapsedCategories((current) => {
            const next = toggle(current, name);
            write(KEYS.collapsedCategories, next);
            return next;
        });
    }, []);

    const toggleMuscleGroup = useCallback((category: string, name: string) => {
        setExpandedMuscleGroups((current) => {
            const next = toggle(current, muscleGroupKey(category, name));
            write(KEYS.expandedMuscleGroups, next);
            return next;
        });
    }, []);

    return {
        state: { collapsedCategories, expandedMuscleGroups },
        toggleCategory,
        toggleMuscleGroup,
        isCategoryOpen: useCallback(
            (name: string) => !collapsedCategories.has(name),
            [collapsedCategories],
        ),
        isMuscleGroupOpen: useCallback(
            (category: string, name: string) =>
                expandedMuscleGroups.has(muscleGroupKey(category, name)),
            [expandedMuscleGroups],
        ),
    };
};
