import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { ScrollView } from '@/components/primitives/scrollview';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Switch } from '@/components/forms/fields/switch';
import { Button } from '@/components/buttons/base';
import { useAudio } from '@/hooks/use-audio';
import { HStack } from '@/components/primitives/hstack';
import { Separator } from '@/components/layout/separator';
import { reportError } from '@/services/error-reporting';
import { markFormValuesSyncing, submitAutoSaveForm } from '../shared';
import { Icon } from '@/components/primitives/icon';

import { VolumeSlider } from './components/volume-slider';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    fieldContainer: {
        backgroundColor: theme.colors.inset,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
    },
    sliderWrapper: {
        gap: theme.space(1),
        ...Platform.select({
            ios: { padding: theme.space(4), alignItems: 'center' as const },
            default: { padding: theme.space(5) },
        }),
    },
    sliderContainer: {
        flex: 1,
        paddingHorizontal: theme.space(2),
    },
    sliderThumb: {
        width: theme.space(6),
        height: theme.space(6),
        borderRadius: theme.radius.full,
        shadowColor: theme.colors.neutral[950],
        shadowOffset: {
            width: 0,
            height: theme.space(1),
        },
        shadowOpacity: 0.2,
        shadowRadius: theme.space(1),
        elevation: 3,
    },
    testSoundButton: {
        padding: theme.space(5),
        width: '100%',
    },
    testSoundButtonText: {
        width: '100%',
        textAlign: 'center',
        fontSize: theme.fontSize.default.fontSize,
    },
    separator: {
        marginHorizontal: theme.space(5),
    },
}));

const SoundScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const {
        control,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            playSounds: user?.playSounds ?? true,
            soundsVolume: user?.soundsVolume ?? 100,
        },
    });

    /* eslint-disable react-hooks/incompatible-library -- RHF hook watcher is stale with controlled settings fields. */
    const watchedPlaySounds = watch('playSounds');
    const watchedSoundsVolume = watch('soundsVolume');
    /* eslint-enable react-hooks/incompatible-library */
    const isUserLoaded = user !== undefined;
    const userPlaySounds = user?.playSounds ?? true;
    const userSoundsVolume = user?.soundsVolume ?? 100;
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const { playWorkoutStart } = useAudio();

    const handleTestSound = useCallback(() => {
        playWorkoutStart();
    }, [playWorkoutStart]);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);
            } catch (error) {
                reportError(error, 'Failed to update user sound preferences:');
            }
        },
        [updateUser],
    );

    const submitCurrentValues = useCallback(() => {
        submitAutoSaveForm(
            isSyncingFormRef,
            isAutoSavingRef,
            handleSubmit,
            onSubmit,
            'Failed to submit sound settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({
                playSounds: userPlaySounds,
                soundsVolume: userSoundsVolume,
            });
        });
    }, [isUserLoaded, userPlaySounds, userSoundsVolume, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (
            isUserLoaded &&
            typeof watchedPlaySounds === 'boolean' &&
            watchedPlaySounds !== userPlaySounds
        ) {
            submitCurrentValues();
        }
        if (
            isUserLoaded &&
            typeof watchedSoundsVolume === 'number' &&
            watchedSoundsVolume !== userSoundsVolume
        ) {
            submitCurrentValues();
        }
    }, [
        isUserLoaded,
        watchedPlaySounds,
        watchedSoundsVolume,
        userPlaySounds,
        userSoundsVolume,
        submitCurrentValues,
    ]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.fieldContainer}>
                <Box>
                    <Switch
                        name="playSounds"
                        control={control}
                        title={t('sound.playSounds', { ns: 'screens' })}
                        error={errors.playSounds}
                    />
                </Box>
            </VStack>
            {watchedPlaySounds && (
                <VStack style={styles.fieldContainer}>
                    <HStack style={styles.sliderWrapper}>
                        <Box>
                            <Icon
                                name="volume-low"
                                size={theme.space(6)}
                                color={theme.colors.typography}
                            />
                        </Box>
                        <Box style={styles.sliderContainer}>
                            <VolumeSlider
                                value={watchedSoundsVolume}
                                onValueChange={(value) => {
                                    setValue('soundsVolume', value);
                                }}
                            />
                        </Box>

                        <Box>
                            <Icon
                                name="volume-high"
                                size={theme.space(6)}
                                color={theme.colors.typography}
                            />
                        </Box>
                    </HStack>
                    <Separator style={styles.separator} />
                    <Button
                        type="link"
                        title={t('sound.testSound', { ns: 'screens' })}
                        containerStyle={styles.testSoundButton}
                        textStyle={styles.testSoundButtonText}
                        size="sm"
                        onPress={handleTestSound}
                    />
                </VStack>
            )}
        </ScrollView>
    );
};

export default SoundScreen;
