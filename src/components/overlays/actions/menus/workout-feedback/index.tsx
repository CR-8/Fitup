import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useActionsStore } from '@/stores/actions';
import { VStack } from '@/components/primitives/vstack';
import { useUpdateWorkout } from '@/hooks/use-workouts';
import { reportError } from '@/services/error-reporting';

import { MenuItem } from '../../components/menu-item';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

/**
 * How hard the session felt, asked once as it is ended.
 *
 * Three taps deep is two too many for something answered while catching your
 * breath, so it is one tap and the sheet closes. Dismissing without answering
 * is a valid outcome — the column stays null and generation simply has one less
 * signal for that session.
 *
 * The answer is written straight onto the workout; `buildHistory` reads it back
 * when the next plan is generated, which is the only reason it is collected.
 */
const WorkoutFeedback: FC = () => {
    const { t } = useTranslation(['screens']);

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const { mutateAsync: updateWorkout } = useUpdateWorkout();

    const handleSelect = useCallback(
        (difficulty: (typeof DIFFICULTIES)[number]) => {
            if (!payload || !('workoutId' in payload)) return;

            const workoutId = payload.workoutId;
            // Closed first: the workout is already saved, so the answer is not
            // worth holding the sheet open for a database round trip.
            close();

            void updateWorkout({ id: workoutId, updates: { difficulty } }).catch((error) =>
                reportError(error, 'Failed to save workout difficulty feedback:'),
            );
        },
        [close, payload, updateWorkout],
    );

    if (!payload || !('workoutId' in payload)) return null;

    return (
        <VStack>
            {DIFFICULTIES.map((difficulty, index) => (
                <MenuItem
                    key={difficulty}
                    title={t(`workout-feedback.${difficulty}`, { ns: 'screens' })}
                    description={t(`workout-feedback.${difficulty}Hint`, { ns: 'screens' })}
                    last={index === DIFFICULTIES.length - 1}
                    onPress={() => handleSelect(difficulty)}
                />
            ))}
        </VStack>
    );
};

export { WorkoutFeedback };
