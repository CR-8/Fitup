import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ChevronDown, Pause, Play, Check, SkipForward } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import Reanimated, { ZoomIn } from 'react-native-reanimated';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { ButtonLabel } from '@/components/buttons/label';
import { NumericStepperField } from '@/components/primitives/numeric-stepper-field';
import { StatBlocks } from '@/components/layout/stat-blocks';
import {
    useCompleteExerciseSet,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useExerciseHistory } from '@/hooks/use-exercises';
import { useUser } from '@/hooks/use-user';
import { formatSet, getOrderedExercisesFromDetails } from '@/helpers/workouts';
import { getExecutionOrderSets } from '@/helpers/execution-order';
import { getWorkoutState } from '@/helpers/workout-simple';
import { exerciseDisplayName } from '@/helpers/exercise-name';
import { buildPauseUpdate, buildResumeUpdate, isSetPaused } from '@/helpers/pause';
import { isWarmupSetType } from '@/helpers/set-type';
import { convertWeight } from '@/helpers/units';
import {
    getStopwatchElapsedSeconds,
    getWorkElapsedSeconds,
    getWorkTimerRemainingSeconds,
} from '@/helpers/workout-timer';
import { getRestSecondsPlanned } from '@/helpers/rest';
import { finalizeRestNow, startNextSetOrExercise, startSet } from '@/services/set-transitions';
import { reportError } from '@/services/error-reporting';
import { buildExerciseGifUrl, EXERCISE_GIF_PREVIEW_RESOLUTION } from '@/constants/fitup';
import { equipmentTranslationKey } from '@/constants/equipment';
import { estimateOneRm } from '@/screens/exercises/exercise/components/statistics/components/metric-utils';

const styles = StyleSheet.create((theme, rt) => ({
    /**
     * One screenful, never a scroll view.
     *
     * Mid-set, a hand on the bar cannot go looking for a control that has been
     * pushed below the fold. Two groups: what you are doing at the top, the
     * controls at the bottom, and any spare height between them.
     */
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: rt.insets.top + theme.space(2),
        paddingBottom: rt.insets.bottom + theme.space(3),
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    /** Takes the leftover height, so the controls sit at the bottom. */
    top: {
        flex: 1,
        minHeight: 0,
        gap: theme.space(3),
    },
    bottom: {
        gap: theme.space(3),
    },
    headerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    headerEnd: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    iconButton: {
        width: theme.space(10),
        height: theme.space(10),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phasePill: {
        paddingVertical: theme.space(1.5),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius.full,
    },
    /**
     * `brand[600]`, not `colors.primary`.
     *
     * The pill's label is `2xs` uppercase, far below the large-text allowance,
     * so white on it has to clear 4.5:1. `brand[500]` is 3.41:1; `brand[600]` is
     * 4.48:1 and still reads as the same coral. Same reasoning as the Home
     * "Up Next" card, which is where this treatment comes from.
     */
    phasePillWork: {
        backgroundColor: theme.colors.brand[600],
    },
    phasePillMuted: {
        backgroundColor: theme.colors.elevated,
    },
    phaseText: {
        ...theme.typography.eyebrow,
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
    metaRow: {
        color: theme.colors.mutedTypography,
        fontVariant: ['tabular-nums'],
    },
    // Text, not a pill — it sits for a few seconds next to the line it
    // follows and then is gone, so it reads as a passing note rather than a
    // badge earning a container of its own.
    personalBest: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
        marginTop: theme.space(0.5),
    },
    /**
     * Grows into spare height up to a cap, rather than all of it — uncapped, a
     * short set list left a mostly-empty white slab. `minHeight: 0` lets it give
     * height back on a short phone instead of pushing the controls off-screen.
     *
     * The source animations are drawn on white, so the plate stays white in
     * both themes rather than showing a grey box behind a white GIF.
     */
    mediaPanel: {
        flex: 1,
        minHeight: 0,
        maxHeight: theme.space(64),
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(3),
    },
    media: {
        flex: 1,
        width: '100%',
    },
    timerPanel: {
        alignItems: 'center',
        gap: theme.space(1),
    },
    // The clock is the focal point while resting or on a timed set, so it gets
    // the largest type on the screen.
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
        marginTop: theme.space(1),
    },
    trackFill: {
        height: '100%',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
    },
    /** The steppers and the action that commits them, as one object. */
    card: {
        gap: theme.space(3),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        padding: theme.space(3),
    },
    steppers: {
        gap: theme.space(3),
    },
    stepper: {
        flex: 1,
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    stepperLabel: {
        ...theme.typography.eyebrow,
        color: theme.colors.mutedTypography,
    },
    // Three rows, then it scrolls: this screen doesn't, so a long exercise must
    // not push the buttons off the bottom.
    checklistScroll: {
        flexGrow: 0,
        maxHeight: theme.space(30),
    },
    checklist: {
        gap: theme.space(1),
    },
    checkRow: (current: boolean) => ({
        alignItems: 'center' as const,
        gap: theme.space(3),
        paddingVertical: theme.space(1.5),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.lg,
        backgroundColor: current ? theme.colors.foreground : 'transparent',
    }),
    checkMark: {
        height: theme.space(5),
        width: theme.space(5),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.success,
    },
    checkCurrent: {
        height: theme.space(5),
        width: theme.space(5),
        borderRadius: theme.radius.full,
        borderWidth: theme.space(1.25),
        borderColor: theme.colors.primary,
    },
    checkPending: {
        height: theme.space(5),
        width: theme.space(5),
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
    },
    checkLabel: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        minWidth: theme.space(12),
    },
    checkValue: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        fontVariant: ['tabular-nums'],
    },
    // Ending early is reachable, not advertised: a quiet link, not a second
    // coral control competing with the set.
    endAction: {
        alignSelf: 'center',
    },
    endActionText: {
        color: theme.colors.mutedTypography,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    completeBody: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.space(2),
    },
    completeBadge: {
        width: theme.space(20),
        height: theme.space(20),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brand[600],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.space(2),
    },
    completeSummary: {
        alignSelf: 'stretch',
        marginTop: theme.space(4),
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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

/**
 * `between` is a running workout with no set active or resting but sets still to
 * do — after a rest ends or is skipped, before the next set starts. It used to
 * fall through to `complete`, which announced "Workout complete" mid-session and
 * offered only End workout.
 */
type Phase = 'work' | 'rest' | 'paused' | 'between' | 'complete';

/**
 * The active-workout screen: what to do now, how long is left of it, and the
 * controls that matter while doing it — on one screenful that never scrolls.
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

    const { runningWorkout, runningWorkoutExercises, completeWorkout, isPendingCompleteWorkout } =
        useRunningWorkoutStatic();
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

    const currentSet = runningWorkoutRestingSet ?? runningWorkoutActiveSet;

    const currentExercise = runningWorkoutActiveExercise?.exercise;

    /**
     * What to offer when no set is active or resting, from the same helper the
     * exercise screen's main button uses — so "Start next set" here and there
     * always name the same set. Recomputed as `currentSet` changes, since the
     * helper reads the clock to tell a rest that is still running from one that
     * has ended.
     */
    const workoutState = useMemo(() => {
        // A set under way is the whole answer, and with no details yet an empty
        // workout would read as a finished one.
        if (currentSet || !workoutDetails) return null;

        const orderedExercises = getOrderedExercisesFromDetails(workoutDetails);
        return getWorkoutState(
            orderedExercises,
            getExecutionOrderSets(orderedExercises, workoutDetails),
        );
    }, [currentSet, workoutDetails]);

    const isWorkoutDone = workoutState?.state === 'completed';
    const nextEntry =
        workoutState?.state === 'ready' && workoutState.nextSet
            ? { set: workoutState.nextSet, exerciseId: workoutState.exerciseId }
            : null;

    /** The exercise this screen is about: the one running, or the one up next. */
    const focusItem = currentSet
        ? runningWorkoutActiveExercise
        : runningWorkoutExercises.find((item) => item.id === nextEntry?.exerciseId);
    const focusExercise = focusItem?.exercise;
    const focusSetId = currentSet?.id ?? nextEntry?.set.id;

    /**
     * Weight and reps for the set under way, edited here and written once on
     * Done — through `completeSet`'s own `updates` — rather than on every tap of a
     * stepper. Keyed by set id and derived, not synced in an effect: when the
     * active set moves on, a draft for the old one simply stops applying.
     */
    const [draft, setDraft] = useState<{ id: string; weight: number; reps: number } | null>(null);
    const tracksWeight = currentExercise?.tracking?.includes('weight') ?? false;
    const tracksReps = currentExercise?.tracking?.includes('reps') ?? false;
    const tracksTime = currentExercise?.tracking?.includes('time') ?? false;
    // Nearly the whole catalogue "tracks weight", push-ups included, so a 0 lb
    // stepper on a bodyweight exercise is noise. It stays when the set already
    // carries a weight — a weighted variant keeps its control.
    const isBodyweight =
        currentExercise?.equipment?.some(
            (value) => equipmentTranslationKey(value) === 'body_weight',
        ) ?? false;
    const showWeight = tracksWeight && !(isBodyweight && !runningWorkoutActiveSet?.weight);
    // Only while a set is being worked: resting, there is nothing to adjust.
    const stepperSet =
        runningWorkoutActiveSet && !runningWorkoutRestingSet && (showWeight || tracksReps)
            ? runningWorkoutActiveSet
            : null;
    const stepperValues = stepperSet
        ? draft?.id === stepperSet.id
            ? draft
            : { id: stepperSet.id, weight: stepperSet.weight ?? 0, reps: stepperSet.reps ?? 0 }
        : null;
    // Steppers take the stage for a weight/reps set, and the clock steps into the
    // phase pill. A timed set keeps its big clock: there, the clock is the point.
    const clockInPill = !!stepperSet && !tracksTime;
    const timeOptions = currentExercise?.timeOptions ?? 'log';
    const paused = isSetPaused(currentSet);

    const { user } = useUser();
    const displayWeightUnits = user?.weightUnits ?? currentExercise?.weightUnits ?? 'kg';
    const { data: exerciseHistory = [] } = useExerciseHistory(currentExercise?.id ?? '');

    // The bar to beat: the best estimated 1RM this exercise has on record
    // before this session — same estimate, same normalization, as the
    // exercise's own stats card, so "best" means the same thing everywhere
    // it's shown. Only ever compared against, never displayed directly.
    const historicalBestOneRm = useMemo(() => {
        if (!currentExercise) return null;

        let best = 0;
        for (const item of exerciseHistory) {
            if (item.workout.id === runningWorkout?.id) continue;

            for (const set of item.sets) {
                if (isWarmupSetType(set.type)) continue;
                if (set.weight == null || set.reps == null) continue;
                if (set.weight <= 0 || set.reps <= 0) continue;

                const sourceUnits =
                    set.weightUnits ?? currentExercise.weightUnits ?? displayWeightUnits;
                const normalizedWeight =
                    sourceUnits === displayWeightUnits
                        ? set.weight
                        : convertWeight(set.weight, sourceUnits, displayWeightUnits);
                const oneRm = estimateOneRm(normalizedWeight, set.reps);
                if (Number.isFinite(oneRm) && oneRm > best) best = oneRm;
            }
        }

        return best > 0 ? best : null;
    }, [currentExercise, displayWeightUnits, exerciseHistory, runningWorkout?.id]);

    // A real personal best, surfaced briefly and then gone — not a badge that
    // sits on screen, just a moment of "that one counted" while it's true.
    const [personalBestLabel, setPersonalBestLabel] = useState<string | null>(null);
    const personalBestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (personalBestTimeoutRef.current) clearTimeout(personalBestTimeoutRef.current);
        };
    }, []);

    const phase: Phase = useMemo(() => {
        if (!currentSet) return isWorkoutDone ? 'complete' : 'between';
        if (paused) return 'paused';
        return runningWorkoutRestingSet ? 'rest' : 'work';
    }, [currentSet, isWorkoutDone, paused, runningWorkoutRestingSet]);

    // A tap on "done" (below) already buzzes for a set finishing; this covers
    // the other way a set's cycle ends — rest running out, whether the clock
    // reached zero on its own or the user skipped it. Both routes leave this
    // screen with the same signal: rest was showing, and now it is not.
    const previousPhaseRef = useRef(phase);
    useEffect(() => {
        if (previousPhaseRef.current === 'rest' && phase !== 'rest') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        previousPhaseRef.current = phase;
    }, [phase]);

    /**
     * Exercise, set and elapsed collapsed onto one line.
     *
     * Exercise position is counted over the workout's exercises rather than the
     * execution order: "exercise 2 of 6" is about movements, not sets.
     */
    const metaLine = useMemo(() => {
        const parts: string[] = [];
        const exercises = workoutDetails?.exercises ?? [];
        const exerciseIndex = exercises.findIndex(
            (entry) => entry.workoutExercise.id === focusItem?.id,
        );
        const sets = (exercises[exerciseIndex]?.sets ?? [])
            .slice()
            .sort((a, b) => a.order - b.order);
        const setIndex = sets.findIndex((set) => set.id === focusSetId);

        // Set first: it is what changes on every tap.
        if (setIndex !== -1) {
            parts.push(
                t('timer.setProgress', {
                    ns: 'screens',
                    current: setIndex + 1,
                    total: sets.length,
                }),
            );
        }

        if (exerciseIndex !== -1) {
            parts.push(
                t('timer.exerciseProgress', {
                    ns: 'screens',
                    current: exerciseIndex + 1,
                    total: exercises.length,
                }),
            );
        }

        return parts.join(' · ');
    }, [focusItem?.id, focusSetId, t, workoutDetails]);

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
        const gifFilename = focusExercise?.gifFilename;
        if (!gifFilename) return '';
        return buildExerciseGifUrl(gifFilename, EXERCISE_GIF_PREVIEW_RESOLUTION);
    }, [focusExercise?.gifFilename]);

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
        const set = runningWorkoutActiveSet;
        if (!set || !workoutDetails) return;

        const edited = draft?.id === set.id ? draft : null;
        const updates = edited
            ? {
                  ...(showWeight ? { weight: edited.weight } : {}),
                  ...(tracksReps ? { reps: edited.reps } : {}),
              }
            : undefined;
        // Judged on what was actually lifted, which is the drafted value when
        // the steppers were used.
        const activeSet = { ...set, ...updates };

        runAction(async () => {
            await completeSet({
                id: activeSet.id,
                workoutId: workoutDetails.workout.id,
                workoutExerciseId: activeSet.workoutExerciseId,
                setType: activeSet.type,
                source: 'phone',
                updates,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Only a genuine beat of real history counts — never on the first
            // time an exercise is ever logged, when every set would trivially
            // "win" against nothing.
            if (
                historicalBestOneRm != null &&
                currentExercise &&
                !isWarmupSetType(activeSet.type) &&
                activeSet.weight != null &&
                activeSet.reps != null &&
                activeSet.weight > 0 &&
                activeSet.reps > 0
            ) {
                const sourceUnits =
                    activeSet.weightUnits ?? currentExercise.weightUnits ?? displayWeightUnits;
                const normalizedWeight =
                    sourceUnits === displayWeightUnits
                        ? activeSet.weight
                        : convertWeight(activeSet.weight, sourceUnits, displayWeightUnits);

                if (estimateOneRm(normalizedWeight, activeSet.reps) > historicalBestOneRm) {
                    if (personalBestTimeoutRef.current) {
                        clearTimeout(personalBestTimeoutRef.current);
                    }
                    setPersonalBestLabel(formatSet(currentExercise, activeSet));
                    personalBestTimeoutRef.current = setTimeout(
                        () => setPersonalBestLabel(null),
                        3500,
                    );
                }
            }

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
        currentExercise,
        displayWeightUnits,
        draft,
        showWeight,
        tracksReps,
        historicalBestOneRm,
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

    const nextSetId = nextEntry?.set.id;

    const handleStartNext = useCallback(() => {
        if (!nextSetId) return;

        runAction(async () => {
            await startSet(nextSetId, updateSet);
        }, 'Failed to start the next set from the timer screen:');
    }, [nextSetId, runAction, updateSet]);

    /**
     * Leaves with the session it was showing.
     *
     * Ending a workout clears `runningWorkout`, which would otherwise strand
     * the user on this screen's "nothing running" state at the exact moment
     * they finished — and it is now the screen every session is driven from, so
     * that is the last thing seen every time. The feedback sheet is presented
     * above whatever this returns to, so it survives the dismissal.
     *
     * Gated on having actually held a workout, so the empty state still renders
     * for someone who opens the timer with nothing running.
     */
    const hasHeldWorkout = useRef(false);

    useEffect(() => {
        if (runningWorkout) {
            hasHeldWorkout.current = true;
            return;
        }

        if (!hasHeldWorkout.current) return;
        hasHeldWorkout.current = false;

        if (router.canGoBack()) router.back();
    }, [runningWorkout]);

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
            <VStack style={styles.container}>
                <VStack style={styles.empty}>
                    <Title type="h3">{t('timer.emptyTitle', { ns: 'screens' })}</Title>
                    <Text style={styles.emptyText}>{t('timer.emptyHint', { ns: 'screens' })}</Text>
                    <Button
                        title={t('timer.emptyAction', { ns: 'screens' })}
                        type="link"
                        onPress={() => router.back()}
                    />
                </VStack>
            </VStack>
        );
    }

    const controlsDisabled = isActionPending || isPendingCompleteWorkout;
    const onCoral = theme.colors.primaryTypography;

    const minimizeButton = (
        <Pressable
            onPress={handleMinimize}
            accessibilityRole="button"
            accessibilityLabel={t('timer.a11y.minimize', { ns: 'screens' })}
        >
            <Box style={styles.iconButton}>
                <ChevronDown
                    size={theme.space(6)}
                    color={theme.colors.typography}
                    strokeWidth={2.5}
                />
            </Box>
        </Pressable>
    );

    if (phase === 'complete') {
        return (
            <VStack style={styles.container}>
                <HStack style={styles.headerRow}>{minimizeButton}</HStack>

                <VStack style={styles.completeBody}>
                    <Reanimated.View entering={ZoomIn.springify()} style={styles.completeBadge}>
                        <Check size={theme.space(10)} color={onCoral} strokeWidth={3} />
                    </Reanimated.View>
                    <Title type="h2">{t('timer.completedTitle', { ns: 'screens' })}</Title>
                    <Text style={styles.muted} numberOfLines={1}>
                        {runningWorkout.name}
                    </Text>
                    <Box style={styles.completeSummary}>
                        <StatBlocks
                            inset={false}
                            blocks={[
                                {
                                    key: 'sets',
                                    value: String(
                                        workoutDetails?.exercises.reduce(
                                            (total, entry) => total + entry.sets.length,
                                            0,
                                        ) ?? 0,
                                    ),
                                    label: t('timer.summary.sets', { ns: 'screens' }),
                                },
                                {
                                    key: 'time',
                                    value: elapsedFormated,
                                    label: t('timer.summary.time', { ns: 'screens' }),
                                },
                                {
                                    key: 'exercises',
                                    value: String(workoutDetails?.exercises.length ?? 0),
                                    label: t('timer.summary.exercises', { ns: 'screens' }),
                                },
                            ]}
                        />
                    </Box>
                </VStack>

                <Button
                    type="primary"
                    title={
                        <ButtonLabel
                            icon={Check}
                            label={t('timer.finish', { ns: 'screens' })}
                            color={onCoral}
                        />
                    }
                    onPress={completeWorkout}
                    loading={isPendingCompleteWorkout}
                    disabled={isPendingCompleteWorkout}
                    accessibilityLabel={t('timer.a11y.endWorkout', { ns: 'screens' })}
                    accessibilityState={{
                        disabled: isPendingCompleteWorkout,
                        busy: isPendingCompleteWorkout,
                    }}
                />
            </VStack>
        );
    }

    const isWorking = !!runningWorkoutActiveSet && !runningWorkoutRestingSet;
    const focusSets = focusItem?.sets ?? [];

    const completeSetButton = (
        <Button
            type="primary"
            title={
                <ButtonLabel
                    icon={Check}
                    label={t('timer.completeSet', { ns: 'screens' })}
                    color={onCoral}
                />
            }
            onPress={handleCompleteSet}
            disabled={controlsDisabled}
            accessibilityLabel={t('timer.a11y.completeSet', { ns: 'screens' })}
            accessibilityState={{ disabled: controlsDisabled, busy: isActionPending }}
        />
    );

    return (
        <VStack style={styles.container}>
            <VStack style={styles.top}>
                <HStack style={styles.headerRow}>
                    {minimizeButton}

                    <HStack style={styles.headerEnd}>
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
                                {clockInPill && readout ? ` · ${readout.value}` : ''}
                            </Text>
                        </Box>

                        {currentSet ? (
                            <Pressable
                                onPress={handleTogglePause}
                                disabled={controlsDisabled}
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                    paused ? 'timer.a11y.continue' : 'timer.a11y.stop',
                                    { ns: 'screens' },
                                )}
                                accessibilityState={{
                                    disabled: controlsDisabled,
                                    busy: isActionPending,
                                }}
                            >
                                <Box style={styles.iconButton}>
                                    {paused ? (
                                        <Play
                                            size={theme.space(4.5)}
                                            color={theme.colors.typography}
                                            fill={theme.colors.typography}
                                        />
                                    ) : (
                                        <Pause
                                            size={theme.space(4.5)}
                                            color={theme.colors.typography}
                                            fill={theme.colors.typography}
                                        />
                                    )}
                                </Box>
                            </Pressable>
                        ) : null}
                    </HStack>
                </HStack>

                <VStack>
                    <Title type="h2" numberOfLines={1}>
                        {focusExercise ? exerciseDisplayName(focusExercise) : ' '}
                    </Title>
                    <Text fontSize="sm" style={styles.metaRow}>
                        {metaLine}
                    </Text>
                    {personalBestLabel ? (
                        <Text style={styles.personalBest}>
                            {t('timer.newBest', { ns: 'screens', value: personalBestLabel })}
                        </Text>
                    ) : null}
                </VStack>

                {gifUrl ? (
                    <Box style={styles.mediaPanel}>
                        <ExpoImage
                            source={{ uri: gifUrl }}
                            style={styles.media}
                            contentFit="contain"
                            autoplay
                        />
                    </Box>
                ) : null}
            </VStack>

            <VStack style={styles.bottom}>
                {/* Rest, and timed sets: the clock is the point. A weight/reps
                    set keeps its clock in the pill and gives the room to the
                    steppers instead. */}
                {readout && !clockInPill ? (
                    <VStack style={styles.timerPanel}>
                        <Title
                            type="h1"
                            style={[styles.timerValue, paused ? styles.timerValuePaused : null]}
                            accessibilityLiveRegion="polite"
                            accessibilityLabel={`${readout.label} ${readout.value}`}
                        >
                            {readout.value}
                        </Title>
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
                    </VStack>
                ) : null}

                {isWorking && stepperSet && stepperValues ? (
                    <VStack style={styles.card}>
                        <HStack style={styles.steppers}>
                            {showWeight ? (
                                <VStack style={styles.stepper}>
                                    <Text style={styles.stepperLabel}>
                                        {`${t('timer.weight', { ns: 'screens' })} · ${
                                            stepperSet.weightUnits ??
                                            currentExercise?.weightUnits ??
                                            displayWeightUnits
                                        }`}
                                    </Text>
                                    <NumericStepperField
                                        compact
                                        value={stepperValues.weight}
                                        unit=""
                                        step={2.5}
                                        min={0}
                                        decimalPlaces={1}
                                        onChange={(weight) =>
                                            setDraft({ ...stepperValues, weight })
                                        }
                                    />
                                </VStack>
                            ) : null}
                            {tracksReps ? (
                                <VStack style={styles.stepper}>
                                    <Text style={styles.stepperLabel}>
                                        {t('timer.reps', { ns: 'screens' })}
                                    </Text>
                                    <NumericStepperField
                                        compact
                                        value={stepperValues.reps}
                                        unit=""
                                        step={1}
                                        min={0}
                                        onChange={(reps) => setDraft({ ...stepperValues, reps })}
                                    />
                                </VStack>
                            ) : null}
                        </HStack>
                        {completeSetButton}
                    </VStack>
                ) : isWorking ? (
                    completeSetButton
                ) : null}

                {runningWorkoutRestingSet ? (
                    <Button
                        type="primary"
                        title={
                            <ButtonLabel
                                icon={SkipForward}
                                label={t('timer.skipRest', { ns: 'screens' })}
                                color={onCoral}
                            />
                        }
                        onPress={handleSkipRest}
                        disabled={controlsDisabled}
                        accessibilityLabel={t('timer.a11y.skipRest', { ns: 'screens' })}
                        accessibilityState={{ disabled: controlsDisabled, busy: isActionPending }}
                    />
                ) : null}

                {phase === 'between' && nextEntry ? (
                    <Button
                        type="primary"
                        title={
                            <ButtonLabel
                                icon={Play}
                                label={t('timer.startNext', { ns: 'screens' })}
                                color={onCoral}
                            />
                        }
                        onPress={handleStartNext}
                        disabled={controlsDisabled}
                        accessibilityLabel={t('timer.a11y.startNext', { ns: 'screens' })}
                        accessibilityState={{ disabled: controlsDisabled, busy: isActionPending }}
                    />
                ) : null}

                {focusSets.length > 0 ? (
                    <ScrollView
                        style={styles.checklistScroll}
                        contentContainerStyle={styles.checklist}
                        showsVerticalScrollIndicator={false}
                    >
                        {focusSets.map((set, index) => {
                            const current = set.id === focusSetId;

                            return (
                                <HStack key={set.id} style={styles.checkRow(current)}>
                                    {set.completedAt ? (
                                        <Reanimated.View
                                            entering={ZoomIn.springify()}
                                            style={styles.checkMark}
                                        >
                                            <Check
                                                size={theme.space(3.5)}
                                                color={theme.colors.white}
                                                strokeWidth={3}
                                            />
                                        </Reanimated.View>
                                    ) : (
                                        <Box
                                            style={
                                                current ? styles.checkCurrent : styles.checkPending
                                            }
                                        />
                                    )}
                                    <Text style={styles.checkLabel}>
                                        {t('timer.setLabel', { ns: 'screens', number: index + 1 })}
                                    </Text>
                                    <Text style={styles.checkValue}>
                                        {formatSet(focusExercise, set) || '–'}
                                    </Text>
                                </HStack>
                            );
                        })}
                    </ScrollView>
                ) : null}

                <Button
                    title={t('timer.endWorkout', { ns: 'screens' })}
                    type="link"
                    onPress={completeWorkout}
                    loading={isPendingCompleteWorkout}
                    disabled={isPendingCompleteWorkout}
                    containerStyle={styles.endAction}
                    textStyle={styles.endActionText}
                    accessibilityLabel={t('timer.a11y.endWorkout', { ns: 'screens' })}
                    accessibilityState={{
                        disabled: isPendingCompleteWorkout,
                        busy: isPendingCompleteWorkout,
                    }}
                />
            </VStack>
        </VStack>
    );
};

export default TimerScreen;
