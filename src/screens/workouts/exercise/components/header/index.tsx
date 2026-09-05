import { FC, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect, WorkoutExerciseSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { ChevronRight, ChevronsUp, Timer } from 'lucide-react-native';
import { Pressable } from '@/components/primitives/pressable';
import { router } from 'expo-router';
import { getPrimaryAnchorMuscleValue } from '@/constants/muscles';
import { PreviewThumbnail } from '@/components/layout/preview';
import { exerciseDisplayName } from '@/helpers/exercise-name';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';

interface HeaderProps {
    exerciseInfo: {
        exercise: ExerciseSelect;
        workoutExercise: WorkoutExerciseSelect;
    } | null;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
        backgroundColor: theme.colors.brand[400],
        paddingBottom: theme.space(5),
        alignItems: 'center',
    },
    titleContainer: {
        paddingHorizontal: theme.space(6),
        alignItems: 'center',
    },
    title: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.neutral[950],
        textAlign: 'center',
    },
    subtitle: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.neutral[950],
    },
    muscleGroupContainer: {
        position: 'relative',
        marginTop: theme.headerContentTopOffset(theme.space(11)),
        marginBottom: theme.space(3.5),
        justifyContent: 'center',
        alignItems: 'center',
        height: theme.space(11),
    },
    muscleGroup: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
        fontSize: theme.fontSize.default.fontSize,
        color: theme.colors.neutral[950],
    },
    actionsContainer: {
        marginTop: theme.space(2.5),
        width: '100%',
        minHeight: theme.space(12),
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
    },
    previewThumbnail: {
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: [{ translateY: -theme.space(6) }],
        marginRight: 0,
    },
    leftActionsContainer: {
        flex: 1,
    },
    centerActionsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightActionsContainer: {
        flex: 1,
        alignItems: 'flex-end',
    },
    rightActions: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    guideButton: {
        height: theme.space(11),
        width: theme.space(11),
        backgroundColor: theme.colors.brand[500],
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewThumbnailContainer: {
        borderWidth: theme.space(0),
        width: theme.space(11),
        height: theme.space(11),
    },
    exerciseLinkWrapper: {
        flexDirection: 'row',
        backgroundColor: theme.colors.brand[500],
        paddingRight: theme.space(1),
        paddingLeft: theme.space(2.5),
        paddingVertical: theme.space(0.25),
        borderRadius: theme.radius['full'],
        alignItems: 'center',
        gap: theme.space(0.5),
    },
    exerciseLink: {
        color: theme.colors.neutral[950],
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
}));

export const Header: FC<HeaderProps> = ({ exerciseInfo }) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();
    const { runningWorkout } = useRunningWorkoutStatic();

    const muscleGroup = useMemo(() => {
        const mg = getPrimaryAnchorMuscleValue(exerciseInfo?.exercise?.primaryMuscleGroups);
        return mg ? t(`muscleGroup.${mg}`, { ns: 'common' }) : '';
    }, [exerciseInfo?.exercise?.primaryMuscleGroups, t]);

    const handleExerciseLinkPress = () => {
        router.navigate(`/exercises/${exerciseInfo?.exercise.id}`);
    };

    const hasGuide = useMemo(() => {
        const exercise = exerciseInfo?.exercise;
        if (!exercise) return false;
        return (
            !!exercise.description ||
            (exercise.instructions && exercise.instructions.length > 0) ||
            (exercise.mistakes && exercise.mistakes.length > 0)
        );
    }, [exerciseInfo?.exercise]);

    const exerciseId = exerciseInfo?.exercise.id;

    const handleGuideOpen = useCallback(() => {
        if (!exerciseId) return;
        router.navigate({
            pathname: '/guide',
            params: { exerciseId },
        });
    }, [exerciseId]);

    const handlePreviewOpen = useCallback((name: string, gifFilename: string) => {
        router.navigate({
            pathname: '/preview',
            params: { name, gifFilename },
        });
    }, []);

    /**
     * The way into the timer, from anywhere in a running workout.
     *
     * Without this there is effectively none. The only other push is the
     * `'ready'` branch of the action button, and `'ready'` means "a set exists
     * that has not been started" — which the app makes sure is almost never
     * true: `startWorkout` auto-starts the first set, and every rest transition
     * auto-starts the next one. So the timer was unreachable for the whole
     * session.
     *
     * Shown only while this workout is the one running, so the button never
     * opens a screen with nothing to show.
     */
    const isRunningWorkout =
        !!runningWorkout && exerciseInfo?.workoutExercise.workoutId === runningWorkout.id;

    const handleTimerOpen = useCallback(() => {
        router.push('/timer');
    }, []);

    return (
        <VStack style={styles.container}>
            <Box style={styles.muscleGroupContainer}>
                <Text style={styles.muscleGroup}>{muscleGroup}</Text>
            </Box>
            <Box style={styles.titleContainer}>
                <Title type="h5" style={styles.title}>
                    {exerciseInfo ? exerciseDisplayName(exerciseInfo.exercise) : 'Exercise'}
                </Title>
                <Text style={styles.subtitle}>
                    {exerciseInfo?.exercise.tracking
                        .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                        .join(' + ')}
                </Text>
            </Box>
            <HStack style={styles.actionsContainer}>
                <Box style={styles.leftActionsContainer}>
                    <PreviewThumbnail
                        name={exerciseInfo ? exerciseDisplayName(exerciseInfo.exercise) : ''}
                        gifFilename={exerciseInfo?.exercise.gifFilename}
                        onOpen={handlePreviewOpen}
                        analyticsSurface="active_workout"
                        analyticsWorkoutId={exerciseInfo?.workoutExercise.workoutId}
                        containerStyle={styles.previewThumbnailContainer}
                    />
                </Box>
                <Box style={styles.centerActionsContainer}>
                    <Pressable style={styles.exerciseLinkWrapper} onPress={handleExerciseLinkPress}>
                        <Text style={styles.exerciseLink}>{t('exercise', { ns: 'common' })}</Text>
                        <ChevronRight size={theme.space(4)} color={theme.colors.neutral[950]} />
                    </Pressable>
                </Box>
                <Box style={styles.rightActionsContainer}>
                    <HStack style={styles.rightActions}>
                        {isRunningWorkout && (
                            <Pressable
                                onPress={handleTimerOpen}
                                accessibilityRole="button"
                                accessibilityLabel={t('timer.open', { ns: 'screens' })}
                            >
                                <Box style={styles.guideButton}>
                                    <Timer
                                        size={theme.space(6)}
                                        color={theme.colors.neutral[950]}
                                    />
                                </Box>
                            </Pressable>
                        )}
                        {hasGuide && (
                            <Pressable onPress={handleGuideOpen}>
                                <Box style={styles.guideButton}>
                                    <ChevronsUp
                                        size={theme.space(6)}
                                        color={theme.colors.neutral[950]}
                                    />
                                </Box>
                            </Pressable>
                        )}
                    </HStack>
                </Box>
            </HStack>
        </VStack>
    );
};
