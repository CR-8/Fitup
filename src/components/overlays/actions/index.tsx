import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet, Column, List, ListItem, Text } from '@expo/ui';

import { brandTint } from '@/components/native/modifiers';
import { useActionsStore } from '@/stores/actions';
import { useStoreReviewGateBlocker } from '@/hooks/use-store-review-gate';
import {
    useWorkoutFeedback,
    WORKOUT_DIFFICULTIES,
    type WorkoutDifficulty,
} from '@/hooks/use-action-menus';

/**
 * How hard the session felt, asked once as it is ended.
 *
 * One tap answers and closes; swiping it away is a valid answer too — the
 * column stays null and the next plan has one signal fewer. `buildHistory`
 * reads the answer back when the next plan is generated.
 */
const ActionsSheet: FC = () => {
    const { t } = useTranslation(['screens']);
    const { type, title, payload, close } = useActionsStore(
        useShallow((state) => ({
            type: state.type,
            title: state.title,
            payload: state.payload,
            close: state.close,
        })),
    );
    const saveFeedback = useWorkoutFeedback();

    useStoreReviewGateBlocker('actions-sheet', !!type);

    const handleSelect = useCallback(
        (difficulty: WorkoutDifficulty) => {
            if (!payload) return;

            close();
            saveFeedback(payload.workoutId, difficulty);
        },
        [close, payload, saveFeedback],
    );

    return (
        <BottomSheet
            isPresented={!!type}
            onDismiss={close}
            snapPoints={['half']}
            modifiers={brandTint}
        >
            <Column spacing={8}>
                {title ? (
                    <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>{title}</Text>
                ) : null}
                <List>
                    {WORKOUT_DIFFICULTIES.map((difficulty) => (
                        <ListItem
                            key={difficulty}
                            supportingText={t(`workout-feedback.${difficulty}Hint`)}
                            onPress={() => handleSelect(difficulty)}
                        >
                            {t(`workout-feedback.${difficulty}`)}
                        </ListItem>
                    ))}
                </List>
            </Column>
        </BottomSheet>
    );
};

export default ActionsSheet;
