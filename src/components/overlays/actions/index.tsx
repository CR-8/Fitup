import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet, Column, List, ListItem, Text } from '@expo/ui';

import { brandTint } from '@/components/native/modifiers';
import { useActionsStore } from '@/stores/actions';
import { useStoreReviewGateBlocker } from '@/hooks/use-store-review-gate';
import { useUpdateWorkout } from '@/hooks/use-workouts';
import { reportError } from '@/services/error-reporting';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

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
    const { mutateAsync: updateWorkout } = useUpdateWorkout();

    useStoreReviewGateBlocker('actions-sheet', !!type);

    const handleSelect = useCallback(
        (difficulty: (typeof DIFFICULTIES)[number]) => {
            if (!payload) return;

            // Closed first: the workout is already saved, so the answer is not
            // worth holding the sheet open for a database round trip.
            close();
            void updateWorkout({ id: payload.workoutId, updates: { difficulty } }).catch((error) =>
                reportError(error, 'Failed to save workout difficulty feedback:'),
            );
        },
        [close, payload, updateWorkout],
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
                    {DIFFICULTIES.map((difficulty) => (
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
