import { FC, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { Button } from '@/components/buttons/base';
import { useStartWorkout, type WorkoutOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useAiAvailable } from '@/hooks/use-ai';
import { useAnalytics } from '@/hooks/use-analytics';
import { reportError } from '@/services/error-reporting';
import { formatWorkoutDuration } from '@/helpers/times';

import { resolveUpNext, type UpNextState } from './resolve';

/**
 * The hero card: the one thing to do now, and the one filled button on the
 * screen that does it. Photography belongs here and nowhere else in a list.
 *
 * `PLACEHOLDER_PHOTO` stands in until the team supplies licensed imagery; swap
 * the file, not the code.
 */
const PLACEHOLDER_PHOTO = require('../../../../../assets/images/placeholders/hero-gym.jpg');

/** Roughly nine minutes an exercise, rounded to five: sets and rest are not loaded here. */
// ponytail: estimate from exercise count; sum sets * (work + rest) if it proves too rough.
const estimateMinutes = (exercisesCount: number): number =>
    Math.max(5, Math.round((exercisesCount * 9) / 5) * 5);

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    card: {
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous' as const,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 79, 0.45)',
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden' as const,
    },
    photo: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    scrim: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    content: {
        padding: theme.space(4),
        gap: theme.space(3),
    },
    eyebrowRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    eyebrow: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    timer: {
        ...theme.fontSize.lg,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    title: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    muscles: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    metaRow: {
        alignItems: 'center',
        gap: theme.space(4),
    },
    metaItem: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    meta: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

interface UpNextProps {
    state: UpNextState;
    overviewMeta?: WorkoutOverviewMeta;
    /** Live elapsed time, when the card is showing a running workout. */
    elapsedFormatted: string | null;
    /** "Push A · Week 2" for the session the card is about, when it has a week. */
    displayName?: string;
}

export { resolveUpNext };
export type { UpNextState };

export const UpNext: FC<UpNextProps> = ({ state, overviewMeta, elapsedFormatted, displayName }) => {
    const { t, i18n } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();
    const { navigate } = useEditor();
    const { track } = useAnalytics();
    const { mutateAsync: startWorkout, isPending } = useStartWorkout();
    // With no plan yet and Syn available, the first step is a plan from Syn;
    // planning a workout by hand stays one tap away.
    const coachFirst = useAiAvailable() && state.kind === 'create';

    const workout = state.kind === 'create' ? null : state.workout;

    const title = useMemo(() => {
        if (state.kind === 'create') return t('home.upNext.createTitle', { ns: 'screens' });
        if (state.kind === 'rest') return t('home.upNext.restTitle', { ns: 'screens' });

        return displayName ?? state.workout.name;
    }, [displayName, state, t]);

    const muscles = useMemo(
        () =>
            (overviewMeta?.sortedPrimaryMuscleGroups ?? [])
                .slice(0, 3)
                .map((muscle) => t(`muscleGroup.${muscle}`, { ns: 'common', defaultValue: muscle }))
                .join(' · '),
        [overviewMeta, t],
    );

    // What sits under the title: the next session on a rest day, the logged time
    // on a finished one, the plan's shape otherwise.
    const detail = useMemo(() => {
        if (state.kind === 'create') {
            return t(coachFirst ? 'home.upNext.coachHint' : 'home.upNext.createHint', {
                ns: 'screens',
            });
        }

        if (state.kind === 'rest') {
            return t('home.upNext.restHint', {
                ns: 'screens',
                name: displayName ?? state.workout.name,
                day: state.workout.startAt
                    ? dayjs(state.workout.startAt).locale(i18n.language).format('ddd D MMM')
                    : '',
            });
        }

        return muscles;
    }, [coachFirst, displayName, i18n.language, muscles, state, t]);

    const exercisesCount = overviewMeta?.exercisesCount ?? 0;
    const showStats = (state.kind === 'start' || state.kind === 'resume') && exercisesCount > 0;
    const doneDuration =
        state.kind === 'done' && state.workout.duration
            ? formatWorkoutDuration(state.workout.duration)
            : null;

    const createWorkout = useCallback(() => {
        track('workout:create_requested', { surface: 'home_up_next' });
        navigate({ type: 'workout__create' });
    }, [navigate, track]);

    const handlePress = useCallback(async () => {
        if (state.kind === 'create') {
            if (coachFirst) router.navigate('/syn');
            else createWorkout();

            return;
        }

        if (state.kind === 'done' || state.kind === 'rest') {
            router.navigate(`/workout/${state.workout.id}`);

            return;
        }

        // Already running: nothing to start, just go back into it, on the timer,
        // the screen for a workout that is under way. Its minimize control goes
        // to `/workout/<id>`, so the logging UI stays one tap away.
        if (state.kind === 'resume') {
            router.navigate('/timer');

            return;
        }

        try {
            await startWorkout({ workoutId: state.workout.id, source: 'planned' });
            router.navigate('/timer');
        } catch (error) {
            reportError(error, 'Failed to start a workout from the home card');
            Alert.alert(t('home.upNext.startFailed', { ns: 'screens' }));
        }
    }, [coachFirst, createWorkout, startWorkout, state, t]);

    const actionLabel = t(
        coachFirst ? 'home.upNext.action.coach' : `home.upNext.action.${state.kind}`,
        {
            ns: 'screens',
        },
    );
    // Only a session that can be started or resumed earns the filled button. A
    // finished day or a rest day offers a quiet outline instead.
    const primary = state.kind === 'start' || state.kind === 'resume' || state.kind === 'create';

    return (
        <Box style={styles.container}>
            <VStack style={styles.card}>
                <Image
                    source={PLACEHOLDER_PHOTO}
                    style={styles.photo}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                />
                <LinearGradient
                    colors={['rgba(8, 9, 11, 0.5)', 'rgba(8, 9, 11, 0.95)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.scrim}
                />

                <VStack style={styles.content}>
                    <HStack style={styles.eyebrowRow}>
                        <Text style={styles.eyebrow}>
                            {t(`home.upNext.eyebrow.${state.kind}`, { ns: 'screens' })}
                        </Text>
                        {state.kind === 'resume' && elapsedFormatted ? (
                            <Text style={styles.timer}>{elapsedFormatted}</Text>
                        ) : null}
                    </HStack>

                    <Pressable
                        disabled={!workout}
                        onPress={() => workout && router.navigate(`/workout/${workout.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={title}
                    >
                        <VStack style={{ gap: theme.space(1) }}>
                            <Text style={styles.title} numberOfLines={2}>
                                {state.kind === 'done'
                                    ? (displayName ?? state.workout.name)
                                    : title}
                            </Text>
                            {detail ? (
                                <Text style={styles.muscles} numberOfLines={1}>
                                    {detail}
                                </Text>
                            ) : null}
                        </VStack>
                    </Pressable>

                    {showStats || doneDuration ? (
                        <HStack style={styles.metaRow}>
                            {showStats ? (
                                <>
                                    <HStack style={styles.metaItem}>
                                        <Icon
                                            name="dumbbell"
                                            size={theme.space(4)}
                                            color={theme.colors.mutedTypography}
                                        />
                                        <Text style={styles.meta}>
                                            {t('home.upNext.exerciseCount', {
                                                ns: 'screens',
                                                count: exercisesCount,
                                            })}
                                        </Text>
                                    </HStack>
                                    <HStack style={styles.metaItem}>
                                        <Icon
                                            name="clock"
                                            size={theme.space(4)}
                                            color={theme.colors.mutedTypography}
                                        />
                                        <Text style={styles.meta}>
                                            {t('home.upNext.minutes', {
                                                ns: 'screens',
                                                count: estimateMinutes(exercisesCount),
                                            })}
                                        </Text>
                                    </HStack>
                                </>
                            ) : (
                                <HStack style={styles.metaItem}>
                                    <Icon
                                        name="clock"
                                        size={theme.space(4)}
                                        color={theme.colors.mutedTypography}
                                    />
                                    <Text style={styles.meta}>{doneDuration}</Text>
                                </HStack>
                            )}
                        </HStack>
                    ) : null}

                    <Button
                        type={primary ? 'primary' : 'outline'}
                        title={actionLabel}
                        loading={isPending}
                        onPress={() => void handlePress()}
                        accessibilityLabel={actionLabel}
                    />
                    {coachFirst ? (
                        <Button
                            type="link"
                            title={t('home.upNext.action.create', { ns: 'screens' })}
                            onPress={createWorkout}
                        />
                    ) : null}
                </VStack>
            </VStack>
        </Box>
    );
};
