import { FC, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Button } from '@/components/buttons/base';
import { useStartWorkout, type WorkoutOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useAiAvailable } from '@/hooks/use-ai';
import { useAnalytics } from '@/hooks/use-analytics';
import { reportError } from '@/services/error-reporting';
import { formatWorkoutDuration } from '@/helpers/times';

import { SESSION_COLORS } from '@/screens/sessions/components/list/types';

import { Tile } from '../cards';
import { Metric } from '../charts';
import { ACCENT } from '../../summary';
import { resolveUpNext, type UpNextState } from './resolve';

/**
 * Today's Workout: the one thing to do now, as a Summary card. The session's
 * name and muscles beside its icon, its size (or the clock, while it runs) in
 * rounded figures, and the one filled button on the screen that starts it.
 */

/** Roughly nine minutes an exercise, rounded to five: sets and rest are not loaded here. */
// ponytail: estimate from exercise count; sum sets * (work + rest) if it proves too rough.
const estimateMinutes = (exercisesCount: number): number =>
    Math.max(5, Math.round((exercisesCount * 9) / 5) * 5);

const styles = StyleSheet.create((theme) => ({
    row: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    icon: {
        height: 52,
        width: 52,
        borderRadius: 14,
        borderCurve: 'continuous' as const,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${ACCENT.distance}26`,
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    name: {
        fontSize: 20,
        lineHeight: 25,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    detail: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    figures: {
        gap: theme.space(6),
    },
    figureLabel: {
        ...theme.fontSize.xs,
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

    const figures: { key: string; value: string; unit?: string; label: string; color: string }[] =
        state.kind === 'resume' && elapsedFormatted
            ? [
                  {
                      key: 'elapsed',
                      value: elapsedFormatted,
                      label: t('home.upNext.elapsed', { ns: 'screens' }),
                      color: ACCENT.distance,
                  },
              ]
            : showStats
              ? [
                    {
                        key: 'exercises',
                        value: String(exercisesCount),
                        label: t('home.upNext.exercisesLabel', {
                            ns: 'screens',
                            count: exercisesCount,
                        }),
                        color: ACCENT.distance,
                    },
                    {
                        key: 'minutes',
                        value: String(estimateMinutes(exercisesCount)),
                        unit: 'min',
                        label: t('home.upNext.estimate', { ns: 'screens' }),
                        color: SESSION_COLORS.time,
                    },
                ]
              : doneDuration
                ? [
                      {
                          key: 'done',
                          value: doneDuration,
                          label: t('home.upNext.logged', { ns: 'screens' }),
                          color: ACCENT.distance,
                      },
                  ]
                : [];

    return (
        <Tile
            title={t(`home.upNext.eyebrow.${state.kind}`, { ns: 'screens' })}
            onPress={workout ? () => router.navigate(`/workout/${workout.id}`) : undefined}
        >
            <HStack style={styles.row}>
                <Box style={styles.icon}>
                    <Icon name="dumbbell" size={24} color={ACCENT.distance} />
                </Box>
                <VStack style={styles.text}>
                    <Text style={styles.name} numberOfLines={2}>
                        {state.kind === 'done' ? (displayName ?? state.workout.name) : title}
                    </Text>
                    {detail ? (
                        <Text style={styles.detail} numberOfLines={2}>
                            {detail}
                        </Text>
                    ) : null}
                </VStack>
            </HStack>

            {figures.length ? (
                <HStack style={styles.figures}>
                    {figures.map((figure) => (
                        <VStack key={figure.key}>
                            <Metric
                                value={figure.value}
                                unit={figure.unit}
                                color={figure.color}
                                size={30}
                            />
                            <Text style={styles.figureLabel}>{figure.label}</Text>
                        </VStack>
                    ))}
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
        </Tile>
    );
};
