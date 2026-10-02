import { FC, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useShallow } from 'zustand/react/shallow';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useActionsStore } from '@/stores/actions';
import { useSetTypeMenu } from '@/hooks/use-action-menus';
import { Choices, ValueType } from '@/components/forms/fields/choices';

const SET_TYPES = ['working', 'warmup', 'dropset', 'failure'] as const;
type SetType = (typeof SET_TYPES)[number];
type SetTypeForm = { type: SetType };

const styles = StyleSheet.create((theme, rt) => ({
    choicesContainer: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
    },
}));

export const SetMenu: FC = () => {
    const { t } = useTranslation(['common']);
    const { theme, rt } = useUnistyles();
    const choicesBackgroundColor =
        rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.solid.background;
    const { control, reset } = useForm<SetTypeForm>({
        defaultValues: {
            type: 'working',
        },
    });

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const setId = payload && 'setId' in payload ? payload.setId : '';
    const setType = payload && 'setId' in payload ? payload.setType : 'working';
    const { onAction } = useSetTypeMenu(setId, setType);

    useEffect(() => {
        if (!payload || !('setId' in payload)) return;
        reset({ type: payload.setType });
    }, [payload, reset]);

    const handleSelectType = useCallback(
        (value: ValueType) => {
            if (typeof value !== 'string') return;

            onAction(value);
            close();
        },
        [close, onAction],
    );

    if (!setId) return null;

    return (
        <Choices
            control={control}
            name="type"
            choices={SET_TYPES.map((setType) => ({
                value: setType,
                title: t(`setType.${setType}`, { ns: 'common' }),
            }))}
            containerStyle={styles.choicesContainer}
            uncheckedIndicatorBackgroundColor={choicesBackgroundColor}
            selectPosition="left"
            onChange={handleSelectType}
        />
    );
};
