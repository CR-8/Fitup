import { describe, expect, test } from '@jest/globals';
import {
    BuildTimerChainParams,
    buildTimerChainEvents,
    TIMER_WARNING_SECONDS,
} from './workout-notification-chain';

describe('buildTimerChainEvents', () => {
    test('schedules work and rest alerts before their timers end', () => {
        const startedAtMs = 100_000;
        const workDurationSeconds = 20;
        const restDurationSeconds = 10;
        const set = {
            id: 'set-1',
            workoutExerciseId: 'workout-exercise-1',
            order: 0,
            type: 'working',
            time: workDurationSeconds,
            restTime: restDurationSeconds,
            startedAt: new Date(startedAtMs),
            completedAt: null,
        };
        const orderedExercises = [
            {
                id: 'workout-exercise-1',
                createdAt: new Date(0),
                sets: [set],
            },
        ] as unknown as BuildTimerChainParams['orderedExercises'];
        const details = {
            workout: { id: 'workout-1' },
            exercises: [
                {
                    workoutExercise: { id: 'workout-exercise-1' },
                    exercise: { name: 'Plank', timeOptions: 'timer' },
                    sets: [set],
                },
            ],
            groups: [],
        } as unknown as NonNullable<BuildTimerChainParams['details']>;

        const events = buildTimerChainEvents({
            nowMs: startedAtMs + 1000,
            workoutId: 'workout-1',
            details,
            orderedExercises,
            maxEvents: 10,
        });
        const warningLeadMs = TIMER_WARNING_SECONDS * 1000;
        const workEndMs = startedAtMs + workDurationSeconds * 1000;
        const restEndMs = workEndMs + restDurationSeconds * 1000;

        expect(events).toEqual([
            {
                kind: 'work-timer',
                setId: 'set-1',
                workoutExerciseId: 'workout-exercise-1',
                fireAtMs: workEndMs - warningLeadMs,
            },
            {
                kind: 'rest-timer',
                fromSetId: 'set-1',
                fireAtMs: restEndMs - warningLeadMs,
                nextSetId: null,
                nextWorkoutExerciseId: null,
            },
        ]);
    });

    test('does not schedule an alert before a short timer starts', () => {
        const startedAtMs = 100_000;
        const set = {
            id: 'set-1',
            workoutExerciseId: 'workout-exercise-1',
            order: 0,
            type: 'working',
            time: 10,
            restTime: 3,
            startedAt: new Date(startedAtMs),
            completedAt: null,
        };
        const orderedExercises = [
            {
                id: 'workout-exercise-1',
                createdAt: new Date(0),
                sets: [set],
            },
        ] as unknown as BuildTimerChainParams['orderedExercises'];
        const details = {
            workout: { id: 'workout-1' },
            exercises: [
                {
                    workoutExercise: { id: 'workout-exercise-1' },
                    exercise: { name: 'Plank', timeOptions: 'timer' },
                    sets: [set],
                },
            ],
            groups: [],
        } as unknown as NonNullable<BuildTimerChainParams['details']>;

        const events = buildTimerChainEvents({
            nowMs: startedAtMs + 1000,
            workoutId: 'workout-1',
            details,
            orderedExercises,
            maxEvents: 10,
        });
        const workEndMs = startedAtMs + 10_000;

        expect(events.find((event) => event.kind === 'rest-timer')?.fireAtMs).toBe(workEndMs);
    });
});

describe('a paused phase', () => {
    const startedAtMs = 100_000;
    const workDurationSeconds = 20;

    const buildParams = (setOverrides: Record<string, unknown>, nowMs: number) => {
        const set = {
            id: 'set-1',
            workoutExerciseId: 'workout-exercise-1',
            order: 0,
            type: 'working',
            time: workDurationSeconds,
            restTime: 10,
            startedAt: new Date(startedAtMs),
            completedAt: null,
            pausedAt: null,
            pausedMs: 0,
            ...setOverrides,
        };
        const orderedExercises = [
            { id: 'workout-exercise-1', createdAt: new Date(0), sets: [set] },
        ] as unknown as BuildTimerChainParams['orderedExercises'];
        const details = {
            workout: { id: 'workout-1' },
            exercises: [
                {
                    workoutExercise: { id: 'workout-exercise-1' },
                    exercise: { name: 'Plank', timeOptions: 'timer' },
                    sets: [set],
                },
            ],
            groups: [],
        } as unknown as NonNullable<BuildTimerChainParams['details']>;

        return { nowMs, workoutId: 'workout-1', details, orderedExercises, maxEvents: 10 };
    };

    test('schedules nothing, so the caller cancels the chain', () => {
        // A notification is an absolute date. While the phase is stopped there
        // is no date to fire on, and every set after it moves by an unknown
        // amount — so the honest chain is the empty one.
        const events = buildTimerChainEvents(
            buildParams({ pausedAt: new Date(startedAtMs + 5_000) }, startedAtMs + 6_000),
        );

        expect(events).toEqual([]);
    });

    test('after resuming, the alerts move out by the time spent paused', () => {
        const pausedMs = 30_000;
        const events = buildTimerChainEvents(
            buildParams({ pausedMs }, startedAtMs + 6_000 + pausedMs),
        );
        const workEndMs = startedAtMs + workDurationSeconds * 1000 + pausedMs;
        const warningLeadMs = TIMER_WARNING_SECONDS * 1000;

        expect(events.find((event) => event.kind === 'work-timer')?.fireAtMs).toBe(
            workEndMs - warningLeadMs,
        );
        expect(events.find((event) => event.kind === 'rest-timer')?.fireAtMs).toBe(
            workEndMs + 10_000 - warningLeadMs,
        );
    });
});
