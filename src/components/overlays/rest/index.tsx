import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import {
    BottomSheet,
    Button as UIButton,
    Column,
    Picker,
    RNHostView,
    Row,
    Spacer,
    Text as UIText,
} from '@expo/ui';
import { useKeyboard } from '@react-native-community/hooks';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { brandTint } from '@/components/native/modifiers';
import { RestChangeType, useRestStore } from '@/stores/rest';
import { useExerciseSets, useUpdateExerciseSet } from '@/hooks/use-workouts';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useStoreReviewGateBlocker } from '@/hooks/use-store-review-gate';
import { digitsFromSeconds, formatClockSecondsCompact, secondsFromDigits } from '@/helpers/times';
import { buildExerciseSetRestUpdate } from './updates';

type Selection = { start: number; end: number };

const isChangeType = (v: unknown): v is RestChangeType =>
    v === 'after_set' || v === 'between_sets' || v === 'after_exercise' || v === 'all_intervals';

const styles = StyleSheet.create((theme) => ({
    inputFieldContainer: {
        position: 'relative',
        alignSelf: 'center',
    },
    underline: (visible: boolean) => ({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: theme.space(1),
        backgroundColor: visible ? theme.colors.primary : 'transparent',
    }),
    text: {
        color: theme.colors.typography,
        fontSize: theme.fontSize['4xl'].fontSize,
        lineHeight: theme.fontSize['4xl'].lineHeight,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        ...theme.typography.metric,
    },
    input: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        color: 'transparent',
    },
}));

const RestInput: FC = () => {
    const [draftValue, setDraftValue] = useState<number | null | undefined>();
    const [draftKey, setDraftKey] = useState<string | null>(null);
    const { keyboardShown } = useKeyboard();
    const { t } = useTranslation(['common']);

    const [focused, setFocused] = useState(false);
    const [digits, setDigits] = useState<string>('');
    const [selection, setSelection] = useState<Selection | undefined>(undefined);

    const { opened, customTitle, close, setId, workoutExerciseId, changeType, setChangeType } =
        useRestStore(
            useShallow((state) => ({
                opened: state.opened,
                customTitle: state.title,
                close: state.close,
                setId: state.setId,
                workoutExerciseId: state.workoutExerciseId,
                changeType: state.changeType,
                setChangeType: state.setChangeType,
            })),
        );
    useStoreReviewGateBlocker('rest-input-sheet', opened);

    const baseTitle = customTitle ?? t('rest', { ns: 'common' });
    const title = baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1);

    const { data: sets } = useExerciseSets(workoutExerciseId || '');
    const { runningWorkoutRestingSet } = useRunningWorkoutTicker();

    const sortedSets = useMemo(
        () => (sets || []).slice().sort((a, b) => a.order - b.order),
        [sets],
    );

    const currentSet = useMemo(
        () => sortedSets.find((s) => s.id === setId) || null,
        [sortedSets, setId],
    );

    const { mutate: updateSet } = useUpdateExerciseSet();

    const buildRestUpdate = useCallback(
        (set: (typeof sortedSets)[number], restValue: number | null) =>
            buildExerciseSetRestUpdate(set, restValue, {
                isCurrentActiveRest: set.id === runningWorkoutRestingSet?.id,
            }),
        [runningWorkoutRestingSet?.id],
    );

    const activeDraftKey = `${workoutExerciseId ?? ''}:${setId ?? 'general'}`;
    const sourceValue = setId ? (currentSet?.restTime ?? null) : null;
    const value = draftKey === activeDraftKey ? draftValue : sourceValue;
    const baseSeconds = Math.max(0, value ?? 0);
    const fallbackDigits = useMemo(() => digitsFromSeconds(baseSeconds), [baseSeconds]);
    const editableDigits = focused ? digits : fallbackDigits;
    const timeDigits = useMemo(() => editableDigits.replace(/\D/g, ''), [editableDigits]);

    const displayText = useMemo(
        () => formatClockSecondsCompact(secondsFromDigits(timeDigits)),
        [timeDigits],
    );

    const choices = useMemo(() => {
        const all = [
            { value: 'after_set' as const },
            { value: 'between_sets' as const },
            { value: 'after_exercise' as const },
            { value: 'all_intervals' as const },
        ];
        if (!setId) {
            return all.filter((c) => c.value !== 'after_set');
        }
        return all;
    }, [setId]);

    const showChangeType = useMemo(() => {
        if (changeType === 'after_set' && setId) {
            return false;
        }
        return true;
    }, [setId, changeType]);

    const inputRef = useCallback((input: TextInput | null | undefined) => {
        if (input !== null && input !== undefined) {
            setTimeout(() => {
                input.focus();
            }, 0);
        }
    }, []);

    useEffect(() => {
        if (opened && !setId && changeType === 'after_set') {
            setChangeType('all_intervals');
        }
    }, [changeType, opened, setChangeType, setId]);

    const handleSheet = () => {
        if (opened && keyboardShown) {
            Keyboard.dismiss();
        }
        setDraftKey(null);
        setDraftValue(undefined);
        setFocused(false);
        setSelection(undefined);
        close();
    };

    const handleButtonChange = (value: string | number) => {
        if (isChangeType(value)) {
            setChangeType(value);
        }
    };

    const handleSave = () => {
        if (!workoutExerciseId) {
            handleSheet();
            return;
        }
        const numeric = typeof value === 'number' ? value : value ? Number(value) : null;
        const nulledNumeric = numeric === 0 ? null : numeric;
        const restValue = nulledNumeric == null ? null : Math.max(0, Math.trunc(nulledNumeric));

        if (changeType === 'after_set') {
            if (setId) {
                const targetSet = currentSet;
                updateSet({
                    id: setId,
                    updates: targetSet
                        ? buildRestUpdate(targetSet, restValue)
                        : { restTime: restValue },
                });
            }
        } else if (changeType === 'between_sets') {
            if (sortedSets.length > 0) {
                for (let i = 0; i < sortedSets.length - 1; i++) {
                    updateSet({
                        id: sortedSets[i].id,
                        updates: buildRestUpdate(sortedSets[i], restValue),
                    });
                }
            }
        } else if (changeType === 'after_exercise') {
            if (sortedSets.length > 0) {
                const last = sortedSets[sortedSets.length - 1];
                updateSet({ id: last.id, updates: buildRestUpdate(last, restValue) });
            }
        } else if (changeType === 'all_intervals') {
            for (const s of sortedSets) {
                updateSet({ id: s.id, updates: buildRestUpdate(s, restValue) });
            }
        }
        handleSheet();
    };

    const handleFocus = () => {
        setFocused(true);
        setDigits(fallbackDigits);
        const end = fallbackDigits.length;
        setSelection({ start: end, end });
    };

    const handleBlur = () => {
        setFocused(false);
        setSelection(undefined);
    };

    const handleChangeText = (t: string) => {
        const d = t.replace(/\D/g, '');
        const nextValue = secondsFromDigits(d) ?? null;
        setDigits(d);
        const end = d.length;
        setSelection({ start: end, end });
        setDraftKey(activeDraftKey);
        setDraftValue(nextValue);
    };

    return (
        <BottomSheet isPresented={opened} onDismiss={handleSheet} modifiers={brandTint}>
            <Column spacing={16}>
                <Row alignment="center">
                    <UIButton
                        variant="text"
                        label={t('cancel', { ns: 'common' })}
                        onPress={handleSheet}
                    />
                    <Spacer />
                    <UIText textStyle={{ fontSize: 17, fontWeight: '600' }}>{title}</UIText>
                    <Spacer />
                    <UIButton
                        variant="text"
                        label={t('save', { ns: 'common' })}
                        onPress={handleSave}
                    />
                </Row>
                <RNHostView matchContents>
                    <Box style={styles.inputFieldContainer}>
                        <Text pointerEvents="none" style={styles.text}>
                            {displayText}
                        </Text>
                        <Box pointerEvents="none" style={styles.underline(focused)} />
                        <TextInput
                            ref={inputRef}
                            keyboardType="number-pad"
                            style={styles.input}
                            editable={true}
                            caretHidden={true}
                            selectionColor="transparent"
                            cursorColor="transparent"
                            value={timeDigits}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            onChangeText={handleChangeText}
                            {...(selection != null ? { selection } : {})}
                            placeholder=""
                        />
                    </Box>
                </RNHostView>
                {showChangeType && (
                    <Picker
                        selectedValue={
                            !setId && changeType === 'after_set' ? 'all_intervals' : changeType
                        }
                        onValueChange={handleButtonChange}
                    >
                        {choices.map((choice) => (
                            <Picker.Item
                                key={choice.value}
                                value={choice.value}
                                label={t(`setRestType.${choice.value}`, { ns: 'common' })}
                            />
                        ))}
                    </Picker>
                )}
            </Column>
        </BottomSheet>
    );
};

export default RestInput;
