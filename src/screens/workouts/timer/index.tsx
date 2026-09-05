import { FC, useCallback, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import { ChevronDown, Pause, Play, Check, SkipForward } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Guide } from '@/screens/exercises/exercise/components/guide';
import {
    useCompleteExerciseSet,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { getOrderedExercisesFromDetails, formatSet } from '@/helpers/workouts';
import { getExecutionOrderSets } from '@/helpers/execution-order';
import { buildPauseUpdate, buildResumeUpdate, isSetPaused } from '@/helpers/pause';
import {
    getStopwatchElapsedSeconds,
    getWorkElapsedSeconds,
    getWorkTimerRemainingSeconds,
} from '@/helpers/workout-timer';
import { getRestSecondsPlanned } from '@/helpers/rest';
import { finalizeRestNow, startNextSetOrExercise } from '@/services/set-transitions';
import { reportError } from '@/services/error-reporting';
import {
    buildExerciseGifUrl,
    EXERCISE_GIF_PREVIEW_RESOLUTION,
    EXERCISE_MEDIA_ATTRIBUTION,
} from '@/constants/fitup';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flexGrow: 1,
        paddingTop: theme.screenHeaderHeight(),
        paddingBottom: rt.insets.bottom + theme.space(6),
        gap: theme.space(4),
    },
    header: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    headerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    minimize: {
        width: theme.space(10),
        height: theme.space(10),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // The eyebrow/pill pair follows the Home "Up Next" card, which is the
    // contrast-audited coral treatment in this app.
    eyebrow: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    phasePill: {
        paddingVertical: theme.space(1.5),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius.full,
    },
    phasePillWork: {
        backgroundColor: theme.colors.primary,
    },
    phasePillMuted: {
        backgroundColor: theme.colors.elevated,
    },
    phaseText: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    phaseTextOnCoral: {
        color: theme.colors.primaryTypography,
    },
    phaseTextOnMuted: {
        color: theme.colors.typography,
    },
    muted: {
        color: theme.colors.mutedTypography,
    },
    progressRow: {
        gap: theme.space(3),
        flexWrap: 'wrap',
    },
    card: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(5),
        gap: theme.space(3),
    },
    // The source animations are drawn on white, so the plate stays white in
    // both themes rather than showing a grey box behind a white GIF.
    mediaPanel: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(4),
        gap: theme.space(2),
        alignItems: 'center',
    },
    media: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: theme.radius['2xl'],
    },
    attribution: {
        color: theme.colors.neutral[500],
    },
    timerPanel: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    // The clock is the focal point while a set is running, so it gets the
    // largest type on the screen.
    timerValue: {
        fontSize: theme.fontSize['4xl'].fontSize * 1.6,
        lineHeight: theme.fontSize['4xl'].lineHeight * 1.6,
        fontVariant: ['tabular-nums'],
    },
    timerValuePaused: {
        opacity: 0.55,
    },
    track: {
        width: '100%',
        height: theme.space(1.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
    },
    // Sits under the clock, so it reads as the set's detail rather than
    // competing with the number above it.
    setSummary: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
        fontVariant: ['tabular-nums'],
    },
    actions: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    primaryAction: {
        backgroundColor: theme.colors.primary,
    },
    primaryActionText: {
        color: theme.colors.primaryTypography,
    },
    secondaryAction: {
        backgroundColor: theme.colors.foreground,
    },
    secondaryActionText: {
        color: theme.colors.typography,
    },
    // Ending the session is not a sibling of the timer controls, so it is
    // pushed away from them and drawn as a link rather than a filled button.
    endAction: {
        marginTop: theme.space(2),
        alignSelf: 'center',
    },
    endActionText: {
        color: theme.colors.destructive,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        gap: theme.space(2),
    },
    emptyText: {
        color: theme.colors.mutedTypography,
        textAlign: 'center',
    },
}));

const formatClock = (totalSeconds: number): string => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

type Phase = 'work' | 'rest' | 'paused' | 'complete';

/**
 * The active-workout screen: what to do now, how long is left of it, and the
 * two controls that matter while doing it.
 *
 * It owns no workout state. Every transition — auto-completing a timed set at
 * zero, moving into rest, starting the next set when rest ends — already
 * happens in `RunningWorkoutProvider` whether this screen is mounted or not.
 * What is added here is pause, which the provider had no concept of, and which
 * is persisted on the set rather than held in React so that backgrounding the
 * app cannot quietly resume it.
 */
const TimerScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();

    const { runningWorkout, completeWorkout, isPendingCompleteWorkout } = useRunningWorkoutStatic();
    const {
        runningWorkoutActiveExercise,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        restRemainingSeconds,
        activeWorkTimerRemainingSeconds,
        activeStopwatchElapsedSeconds,
        elapsedFormated,
        nowMs,
    } = useRunningWorkoutTicker();

    const [isActionPending, setIsActionPending] = useState(false);

    const { data: workoutDetails } = useWorkoutWithDetails(runningWorkout?.id ?? '');
    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const { mutateAsync: completeSet } = useCompleteExerciseSet();

    const orderedExercises = useMemo(
        () => getOrderedExercisesFromDetails(workoutDetails),
        [workoutDetails],
    );

    // Execution order, not the exercise list: in a superset the next set
    // belongs to the next movement, not to the next set of this one.
    const executionOrderSets = useMemo(
        () => getExecutionOrderSets(orderedExercises, workoutDetails),
        [orderedExercises, workoutDetails],
    );

    const currentSet = runningWorkoutRestingSet ?? runningWorkoutActiveSet;

    const nextEntry = useMemo(() => {
        if (!currentSet) return undefined;
        const index = executionOrderSets.findIndex((entry) => entry.set.id === currentSet.id);
        if (index === -1) return undefined;
        return executionOrderSets.slice(index + 1).find((entry) => !entry.set.completedAt);
    }, [executionOrderSets, currentSet]);

    const exerciseById = useMemo(
        () => new Map(workoutDetails?.exercises.map((x) => [x.workoutExercise.id, x]) ?? []),
        [workoutDetails],
    );

    const currentExercise = runningWorkoutActiveExercise?.exercise;
    const timeOptions = currentExercise?.timeOptions ?? 'log';
    const paused = isSetPaused(currentSet);

    const phase: Phase = useMemo(() => {
        if (!currentSet) return 'complete';
        if (paused) return 'paused';
        return runningWorkoutRestingSet ? 'rest' : 'work';
    }, [currentSet, paused, runningWorkoutRestingSet]);

    // Counted over the ordered exercise list rather than the execution order:
    // "exercise 2 of 6" is about movements, not sets.
    const exerciseProgress = useMemo(() => {
        if (!runningWorkoutActiveExercise) return null;
        const index = orderedExercises.findIndex((ex) => ex.id === runningWorkoutActiveExercise.id);
        if (index === -1) return null;
        return { current: index + 1, total: orderedExercises.length };
    }, [orderedExercises, runningWorkoutActiveExercise]);

    const setProgress = useMemo(() => {
        const sets = runningWorkoutActiveExercise?.sets;
        if (!currentSet || !sets?.length) return null;
        const index = sets.findIndex((set) => set.id === currentSet.id);
        if (index === -1) return null;
        return { current: index + 1, total: sets.length };
    }, [currentSet, runningWorkoutActiveExercise]);

    /** What the set asks for — "60 kg x 10". Empty when there is nothing to say. */
    const setSummary = useMemo(
        () => (currentSet ? formatSet(currentExercise, currentSet) : ''),
        [currentExercise, currentSet],
    );

    /**
     * The readout, and how far through the phase it is.
     *
     * Paused values come from the same helpers as running ones — the offset on
     * the set is what makes them hold still — so there is no separate frozen
     * branch here to drift out of step with the rest of the app.
     */
    const readout = useMemo(() => {
        if (runningWorkoutRestingSet) {
            const planned = getRestSecondsPlanned(runningWorkoutRestingSet);
            const remaining = restRemainingSeconds ?? planned;
            return {
                label: t('timer.restRemaining', { ns: 'screens' }),
                value: formatClock(remaining),
                fraction: planned > 0 ? 1 - remaining / planned : 0,
            };
        }

        if (!runningWorkoutActiveSet) return null;

        if (timeOptions === 'timer') {
            const planned = Math.max(0, runningWorkoutActiveSet.time ?? 0);
            const remaining =
                activeWorkTimerRemainingSeconds ??
                getWorkTimerRemainingSeconds(runningWorkoutActiveSet, planned, nowMs) ??
                planned;
            return {
                label: t('timer.remaining', { ns: 'screens' }),
                value: formatClock(remaining),
                fraction: planned > 0 ? 1 - remaining / planned : 0,
            };
        }

        if (timeOptions === 'stopwatch') {
            const elapsed =
                activeStopwatchElapsedSeconds ??
                getStopwatchElapsedSeconds(runningWorkoutActiveSet, nowMs) ??
                0;
            return {
                label: t('timer.elapsed', { ns: 'screens' }),
                value: formatClock(elapsed),
                // A stopwatch has no end, so there is nothing honest to fill.
                fraction: null,
            };
        }

        // Ordinary reps sets — `timeOptions` of 'log', or null, which is most of
        // the catalogue. They have no configured duration, but this screen is a
        // clock: counting up on the set is the honest thing to show, and without
        // it a normal strength workout got no readout at all.
        const elapsed = getWorkElapsedSeconds(runningWorkoutActiveSet, nowMs);
        if (elapsed == null) return null;

        return {
            label: t('timer.setElapsed', { ns: 'screens' }),
            value: formatClock(elapsed),
            fraction: null,
        };
    }, [
        activeStopwatchElapsedSeconds,
        activeWorkTimerRemainingSeconds,
        nowMs,
        restRemainingSeconds,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        t,
        timeOptions,
    ]);

    const gifUrl = useMemo(() => {
        const gifFilename = currentExercise?.gifFilename;
        if (!gifFilename) return '';
        return buildExerciseGifUrl(gifFilename, EXERCISE_GIF_PREVIEW_RESOLUTION);
    }, [currentExercise?.gifFilename]);

    /** One gate for every mutation on this screen, so a double tap cannot race. */
    const runAction = useCallback(
        (action: () => Promise<void>, label: string) => {
            if (isActionPending) return;
            setIsActionPending(true);
            action()
                .catch((error) => reportError(error, label))
                .finally(() => setIsActionPending(false));
        },
        [isActionPending],
    );

    const handleTogglePause = useCallback(() => {
        if (!currentSet) return;

        runAction(async () => {
            const updates = paused
                ? buildResumeUpdate(currentSet, Date.now())
                : buildPauseUpdate(currentSet, Date.now());

            // Null means the set is already in the state being asked for, which
            // is what a second tap on a stale render looks like.
            if (!updates) return;

            await updateSet({ id: currentSet.id, updates });
        }, 'Failed to toggle workout timer pause:');
    }, [currentSet, paused, runAction, updateSet]);

    const handleCompleteSet = useCallback(() => {
        const activeSet = runningWorkoutActiveSet;
        if (!activeSet || !workoutDetails) return;

        runAction(async () => {
            await completeSet({
                id: activeSet.id,
                workoutId: workoutDetails.workout.id,
                workoutExerciseId: activeSet.workoutExerciseId,
                setType: activeSet.type,
                source: 'phone',
            });

            // Sets with rest hand over to the provider's rest transition; the
            // ones without it have nothing else to advance them.
            const restTime = activeSet.restTime;
            if (!restTime || restTime <= 0) {
                await startNextSetOrExercise(
                    activeSet,
                    workoutDetails,
                    updateSet,
                    () => undefined,
                    runningWorkoutActiveExercise?.id,
                );
            }
        }, 'Failed to complete set from the timer screen:');
    }, [
        completeSet,
        runAction,
        runningWorkoutActiveExercise?.id,
        runningWorkoutActiveSet,
        updateSet,
        workoutDetails,
    ]);

    const handleSkipRest = useCallback(() => {
        const restingSet = runningWorkoutRestingSet;
        if (!restingSet || !workoutDetails) return;

        runAction(async () => {
            await finalizeRestNow(restingSet, updateSet, Date.now());
            await startNextSetOrExercise(
                restingSet,
                workoutDetails,
                updateSet,
                () => undefined,
                runningWorkoutActiveExercise?.id,
            );
        }, 'Failed to skip rest from the timer screen:');
    }, [
        runAction,
        runningWorkoutActiveExercise?.id,
        runningWorkoutRestingSet,
        updateSet,
        workoutDetails,
    ]);

    const handleMinimize = useCallback(() => {
        // Back to the logging UI rather than out of the session entirely.
        if (runningWorkout?.id) {
            router.navigate(`/workout/${runningWorkout.id}`);
            return;
        }
        router.back();
    }, [runningWorkout]);

    if (!runningWorkout) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <VStack style={styles.empty}>
                    <Title type="h3">{t('timer.emptyTitle', { ns: 'screens' })}</Title>
                    <Text style={styles.emptyText}>{t('timer.emptyHint', { ns: 'screens' })}</Text>
                    <Button
                        title={t('timer.emptyAction', { ns: 'screens' })}
                        type="link"
                        onPress={() => router.back()}
                    />
                </VStack>
            </ScrollView>
        );
    }

    const isComplete = phase === 'complete';
    const controlsDisabled = isActionPending || isPendingCompleteWorkout;
    const nextExercise = nextEntry ? exerciseById.get(nextEntry.exerciseId) : undefined;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.header}>
                <HStack style={styles.headerRow}>
                    <Pressable
                        onPress={handleMinimize}
                        accessibilityRole="button"
                        accessibilityLabel={t('timer.a11y.minimize', { ns: 'screens' })}
                    >
                        <Box style={styles.minimize}>
                            <ChevronDown
                                size={theme.space(6)}
                                color={theme.colors.typography}
                                strokeWidth={2.5}
                            />
                        </Box>
                    </Pressable>

                    <Box
                        style={[
                            styles.phasePill,
                            phase === 'work' ? styles.phasePillWork : styles.phasePillMuted,
                        ]}
                    >
                        <Text
                            style={[
                                styles.phaseText,
                                phase === 'work'
                                    ? styles.phaseTextOnCoral
                                    : styles.phaseTextOnMuted,
                            ]}
                        >
                            {t(`timer.phase.${phase}`, { ns: 'screens' })}
                        </Text>
                    </Box>
                </HStack>

                <VStack>
                    <Text style={styles.eyebrow}>{runningWorkout.name}</Text>
                    <Title type="h2">
                        {runningWorkoutActiveExercise?.name ??
                            t('timer.completedTitle', { ns: 'screens' })}
                    </Title>
                </VStack>

                <HStack style={styles.progressRow}>
                    {exerciseProgress ? (
                        <Text fontSize="sm" style={styles.muted}>
                            {t('timer.exerciseProgress', { ns: 'screens', ...exerciseProgress })}
                        </Text>
                    ) : null}
                    {setProgress ? (
                        <Text fontSize="sm" style={styles.muted}>
                            {t('timer.setProgress', { ns: 'screens', ...setProgress })}
                        </Text>
                    ) : null}
                    <Text fontSize="sm" style={styles.muted}>
                        {elapsedFormated}
                    </Text>
                </HStack>
            </VStack>

            {gifUrl ? (
                <VStack style={styles.mediaPanel}>
                    <ExpoImage
                        source={{ uri: gifUrl }}
                        style={styles.media}
                        contentFit="contain"
                        autoplay
                    />
                    <Text fontSize="2xs" style={styles.attribution}>
                        {EXERCISE_MEDIA_ATTRIBUTION}
                    </Text>
                </VStack>
            ) : null}

            <VStack style={[styles.card, styles.timerPanel]}>
                {isComplete ? (
                    <>
                        <Title type="h3">{t('timer.completedTitle', { ns: 'screens' })}</Title>
                        <Text fontSize="sm" style={styles.muted}>
                            {t('timer.completedHint', { ns: 'screens' })}
                        </Text>
                    </>
                ) : readout ? (
                    <>
                        <Title
                            type="h1"
                            style={[styles.timerValue, paused ? styles.timerValuePaused : null]}
                            accessibilityLiveRegion="polite"
                            accessibilityLabel={`${readout.label} ${readout.value}`}
                        >
                            {readout.value}
                        </Title>
                        <Text style={styles.eyebrow}>{readout.label}</Text>
                        {readout.fraction !== null ? (
                            <Box style={styles.track}>
                                <Box
                                    style={[
                                        styles.trackFill,
                                        {
                                            width: `${Math.min(100, Math.max(0, readout.fraction * 100))}%`,
                                        },
                                    ]}
                                />
                            </Box>
                        ) : null}
                        {/* What the set is actually asking for, under the clock
                            rather than instead of it. */}
                        {setSummary ? <Text style={styles.setSummary}>{setSummary}</Text> : null}
                    </>
                ) : (
                    // No active set to time — between sets, or while the data is
                    // still loading. The set line is all there is to say.
                    <>
                        <Text style={styles.setSummary}>{setSummary || '—'}</Text>
                        <Text style={styles.eyebrow}>
                            {t('timer.inProgress', { ns: 'screens' })}
                        </Text>
                    </>
                )}
            </VStack>

            <VStack style={styles.card}>
                <Text style={styles.eyebrow}>{t('timer.nextUp', { ns: 'screens' })}</Text>
                {nextEntry ? (
                    <VStack>
                        <Text fontWeight="semibold">{nextExercise?.exercise.name ?? ''}</Text>
                        <Text fontSize="sm" style={styles.muted}>
                            {formatSet(nextExercise?.exercise, nextEntry.set) ||
                                t('timer.inProgress', { ns: 'screens' })}
                        </Text>
                    </VStack>
                ) : (
                    <Text fontSize="sm" style={styles.muted}>
                        {t('timer.noNextSet', { ns: 'screens' })}
                    </Text>
                )}
            </VStack>

            {!isComplete ? (
                <VStack style={styles.actions}>
                    <Button
                        title={
                            paused
                                ? t('timer.continue', { ns: 'screens' })
                                : t('timer.stop', { ns: 'screens' })
                        }
                        prefix={
                            paused ? (
                                <Play
                                    size={theme.space(5)}
                                    color={theme.colors.primaryTypography}
                                    fill={theme.colors.primaryTypography}
                                />
                            ) : (
                                <Pause
                                    size={theme.space(5)}
                                    color={theme.colors.primaryTypography}
                                    fill={theme.colors.primaryTypography}
                                />
                            )
                        }
                        onPress={handleTogglePause}
                        disabled={controlsDisabled || !currentSet}
                        containerStyle={styles.primaryAction}
                        textStyle={styles.primaryActionText}
                        accessibilityRole="button"
                        accessibilityLabel={t(paused ? 'timer.a11y.continue' : 'timer.a11y.stop', {
                            ns: 'screens',
                        })}
                        accessibilityState={{ disabled: controlsDisabled, busy: isActionPending }}
                    />

                    {runningWorkoutRestingSet ? (
                        <Button
                            title={t('timer.skipRest', { ns: 'screens' })}
                            prefix={
                                <SkipForward
                                    size={theme.space(5)}
                                    color={theme.colors.typography}
                                />
                            }
                            onPress={handleSkipRest}
                            disabled={controlsDisabled}
                            containerStyle={styles.secondaryAction}
                            textStyle={styles.secondaryActionText}
                            accessibilityRole="button"
                            accessibilityLabel={t('timer.a11y.skipRest', { ns: 'screens' })}
                            accessibilityState={{
                                disabled: controlsDisabled,
                                busy: isActionPending,
                            }}
                        />
                    ) : (
                        <Button
                            title={t('timer.completeSet', { ns: 'screens' })}
                            prefix={
                                <Check
                                    size={theme.space(5)}
                                    color={theme.colors.typography}
                                    strokeWidth={2.5}
                                />
                            }
                            onPress={handleCompleteSet}
                            disabled={controlsDisabled || !runningWorkoutActiveSet}
                            containerStyle={styles.secondaryAction}
                            textStyle={styles.secondaryActionText}
                            accessibilityRole="button"
                            accessibilityLabel={t('timer.a11y.completeSet', { ns: 'screens' })}
                            accessibilityState={{
                                disabled: controlsDisabled,
                                busy: isActionPending,
                            }}
                        />
                    )}
                </VStack>
            ) : null}

            <Box style={styles.actions}>
                <Button
                    title={t('timer.endWorkout', { ns: 'screens' })}
                    type="link"
                    onPress={completeWorkout}
                    loading={isPendingCompleteWorkout}
                    disabled={isPendingCompleteWorkout}
                    containerStyle={styles.endAction}
                    textStyle={styles.endActionText}
                    accessibilityRole="button"
                    accessibilityLabel={t('timer.a11y.endWorkout', { ns: 'screens' })}
                    accessibilityState={{
                        disabled: isPendingCompleteWorkout,
                        busy: isPendingCompleteWorkout,
                    }}
                />
            </Box>

            {currentExercise ? <Guide exercise={currentExercise} showHero={false} /> : null}
        </ScrollView>
    );
};

export default TimerScreen;
