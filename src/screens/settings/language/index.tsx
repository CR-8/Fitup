import { useEffect, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { ScrollView } from '@/components/primitives/scrollview';
import { Choices } from '@/components/forms/fields/choices';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { localeNames, normalizeLanguage, supportedLanguages } from '@/locale/constants';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';
import { markFormValuesSyncing, submitAutoSaveForm } from '../shared';
import { performFitupSync } from '@/sync';
import { queryClient } from '@/queries';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
}));

const LanguageScreen = () => {
    const { user, updateUser } = useUser();

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            // A language that is no longer offered would leave every row
            // unselected, which reads as "no language" rather than English.
            lng: normalizeLanguage(user?.lng),
        },
    });

    /* eslint-disable react-hooks/incompatible-library -- RHF hook watcher is stale with controlled settings fields. */
    const watchedLng = watch('lng');
    /* eslint-enable react-hooks/incompatible-library */
    const isUserLoaded = user !== undefined;
    const userLng = normalizeLanguage(user?.lng);
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);

                if (data.lng && data.lng !== userLng) {
                    const fullFitupReloadResult = await performFitupSync({
                        locale: data.lng,
                        full: true,
                    });

                    if (fullFitupReloadResult) {
                        queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
                        queryClient.invalidateQueries({ queryKey: ['exercise'] });
                        queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
                        queryClient.invalidateQueries({ queryKey: ['workout-details'] });
                        queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
                        queryClient.invalidateQueries({
                            queryKey: ['workout-exercises-with-exercise'],
                        });
                    }
                }
            } catch (error) {
                reportError(error, 'Failed to update user language:');
            }
        },
        [updateUser, userLng],
    );

    const submitCurrentValues = useCallback(() => {
        submitAutoSaveForm(
            isSyncingFormRef,
            isAutoSavingRef,
            handleSubmit,
            onSubmit,
            'Failed to submit language settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({ lng: userLng });
        });
    }, [isUserLoaded, userLng, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (isUserLoaded && watchedLng && watchedLng !== userLng) {
            submitCurrentValues();
        }
    }, [isUserLoaded, watchedLng, userLng, submitCurrentValues]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Choices
                control={control}
                name="lng"
                choices={supportedLanguages.map((v) => ({
                    value: v,
                    title: localeNames[v],
                }))}
                error={errors.lng}
                selectPosition="right"
            />
        </ScrollView>
    );
};

export default LanguageScreen;
