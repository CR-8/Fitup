import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useActionsStore } from '@/stores/actions';
import { VStack } from '@/components/primitives/vstack';
import {
    useWorkoutFeedback,
    WORKOUT_DIFFICULTIES,
    type WorkoutDifficulty,
} from '@/hooks/use-action-menus';

import { MenuItem } from '../../components/menu-item';

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

    const saveFeedback = useWorkoutFeedback();

    const handleSelect = useCallback(
        (difficulty: WorkoutDifficulty) => {
            if (!payload || !('workoutId' in payload)) return;

            close();
            saveFeedback(payload.workoutId, difficulty);
        },
        [close, payload, saveFeedback],
    );

    if (!payload || !('workoutId' in payload)) return null;

    return (
        <VStack>
            {WORKOUT_DIFFICULTIES.map((difficulty, index) => (
                <MenuItem
                    key={difficulty}
                    title={t(`workout-feedback.${difficulty}`, { ns: 'screens' })}
                    description={t(`workout-feedback.${difficulty}Hint`, { ns: 'screens' })}
                    last={index === WORKOUT_DIFFICULTIES.length - 1}
                    onPress={() => handleSelect(difficulty)}
                />
            ))}
        </VStack>
    );
};

export { WorkoutFeedback };
