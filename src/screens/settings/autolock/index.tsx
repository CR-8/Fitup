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
import { Title } from '@/components/typography/title';
import { Text } from '@/components/primitives/text';
import { Separator } from '@/components/layout/separator';
import { Switch } from '@/components/forms/fields/switch';
import { reportError } from '@/services/error-reporting';
import { markFormValuesSyncing, submitAutoSaveForm } from '../shared';
import { Icon } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    headerContainer: {
        padding: theme.space(5),
        backgroundColor: theme.colors.inset,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        gap: theme.space(5),
    },
    headerTitleContainer: {
        gap: theme.space(2),
    },
    description: {
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    iconContainer: {
        height: theme.space(15),
        width: theme.space(15),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Platform.select({
            ios: theme.colors.primary,
            default: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        }),
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
        marginBottom: theme.space(2),
    },
    screenAutoLock: {
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
}));

const AutoLockScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            screenAutoLock: user?.screenAutoLock ?? true,
        },
    });

    /* eslint-disable react-hooks/incompatible-library -- RHF hook watcher is stale with controlled settings fields. */
    const watchedScreenAutoLock = watch('screenAutoLock');
    /* eslint-enable react-hooks/incompatible-library */
    const isUserLoaded = user !== undefined;
    const userScreenAutoLock = user?.screenAutoLock ?? true;
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);
            } catch (error) {
                reportError(error, 'Failed to update auto-lock settings:');
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
            'Failed to submit auto-lock settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({
                screenAutoLock: userScreenAutoLock,
            });
        });
    }, [isUserLoaded, userScreenAutoLock, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (
            isUserLoaded &&
            typeof watchedScreenAutoLock === 'boolean' &&
            watchedScreenAutoLock !== userScreenAutoLock
        ) {
            submitCurrentValues();
        }
    }, [isUserLoaded, watchedScreenAutoLock, userScreenAutoLock, submitCurrentValues]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.headerContainer}>
                <VStack style={styles.headerTitleContainer}>
                    <Box style={styles.iconContainer}>
                        <Icon
                            name="lock"
                            size={theme.space(8)}
                            color={Platform.select({
                                ios: theme.colors.primaryTypography,
                                default:
                                    rt.themeName === 'dark'
                                        ? theme.colors.neutral[950]
                                        : theme.colors.white,
                            })}
                        />
                    </Box>
                    <Box>
                        <Title type="h3">{t('autolock.title', { ns: 'screens' })}</Title>
                    </Box>
                    <Box>
                        <Text style={styles.description}>
                            {t('autolock.description', { ns: 'screens' })}
                        </Text>
                    </Box>
                </VStack>
                <Separator />
                <VStack>
                    <Box>
                        <Switch
                            name="screenAutoLock"
                            control={control}
                            title={t('autolock.title', { ns: 'screens' })}
                            error={errors.screenAutoLock}
                            containerStyle={styles.screenAutoLock}
                        />
                    </Box>
                </VStack>
            </VStack>
        </ScrollView>
    );
};

export default AutoLockScreen;
