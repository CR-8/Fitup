import { describe, expect, test } from '@jest/globals';

import { getWorkoutState } from './workout-simple';
import type { ExecutionOrderSet } from '@/helpers/execution-order';
import type { ExerciseSetSelect } from '@/db/schema';

/**
 * The action button lives on one exercise's screen. These cases pin that it acts
 * on that exercise, rather than on whichever set the workout pointer happens to
 * be sitting on.
 */

const buildSet = (id: string, overrides: Partial<ExerciseSetSelect> = {}): ExerciseSetSelect =>
    ({
        id,
        workoutExerciseId: 'we-1',
        order: 0,
        type: 'working',
        weight: null,
        reps: 10,
        time: null,
        distance: null,
        rpe: null,
        restTime: null,
        startedAt: null,
        completedAt: null,
        restCompletedAt: null,
        pausedAt: null,
        pausedMs: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }) as unknown as ExerciseSetSelect;

/** Exercise A has an in-progress set; exercise B is untouched. */
const buildOrder = (): ExecutionOrderSet[] => [
    { set: buildSet('a1', { startedAt: new Date() }), exerciseId: 'exerciseA' },
    { set: buildSet('a2'), exerciseId: 'exerciseA' },
    { set: buildSet('b1'), exerciseId: 'exerciseB' },
    { set: buildSet('b2'), exerciseId: 'exerciseB' },
];

describe('getWorkoutState', () => {
    test('unscoped, it reports the global pointer', () => {
        const info = getWorkoutState([], buildOrder());

        expect(info.state).toBe('performing');
        expect(info.exerciseId).toBe('exerciseA');
        expect(info.currentSet?.id).toBe('a1');
    });

    test('scoped to the viewed exercise, it does not reach into another one', () => {
        // Standing on exercise B while exercise A holds the pointer. Before this
        // was scoped, the action here completed exercise A's first set.
        const info = getWorkoutState([], buildOrder(), 'exerciseB');

        expect(info.exerciseId).toBe('exerciseB');
        expect(info.currentSet?.id).toBeUndefined();
        expect(info.state).toBe('ready');
        expect(info.nextSet?.id).toBe('b1');
    });

    test('scoped to the exercise that is mid-set, it completes that set', () => {
        const info = getWorkoutState([], buildOrder(), 'exerciseA');

        expect(info.state).toBe('performing');
        expect(info.currentSet?.id).toBe('a1');
    });

    test('reports an exercise whose sets are all done as completed', () => {
        const order: ExecutionOrderSet[] = [
            { set: buildSet('a1', { completedAt: new Date() }), exerciseId: 'exerciseA' },
            { set: buildSet('b1'), exerciseId: 'exerciseB' },
        ];

        expect(getWorkoutState([], order, 'exerciseA').state).toBe('completed');
        expect(getWorkoutState([], order, 'exerciseB').state).toBe('ready');
    });

    test('an unknown exercise id yields no work rather than falling back to global', () => {
        const info = getWorkoutState([], buildOrder(), 'exerciseZ');

        expect(info.state).toBe('completed');
        expect(info.currentSet).toBeUndefined();
    });

    test('resting still counts the rest of the workout when scoped', () => {
        const restingSet = buildSet('a1', {
            completedAt: new Date(),
            restTime: 90,
            startedAt: new Date(),
        });

        const order: ExecutionOrderSet[] = [
            { set: restingSet, exerciseId: 'exerciseA' },
            { set: buildSet('b1'), exerciseId: 'exerciseB' },
        ];

        // Exercise A has nothing left, but the workout does, so this must not be
        // reported as "resting with nothing next".
        const info = getWorkoutState([], order, 'exerciseA');

        expect(info.state).toBe('resting');
        expect(info.nextSet?.id).toBe('b1');
    });
});

/**
 * The phases a set moves through, read straight off its own columns.
 *
 * There is no stored "phase" anywhere — these five states are re-derived on
 * every render from `startedAt`, `completedAt`, `restTime` and the clock. That
 * is what keeps the four copies of this machine in agreement, and what makes a
 * pause that is not visible on the row a source of disagreement.
 */
describe('moving through a set', () => {
    const T0 = 1_700_000_000_000;
    const at = (offsetMs: number) => new Date(T0 + offsetMs);

    test('completing a set with rest moves from performing into resting', () => {
        const performing: ExecutionOrderSet[] = [
            { set: buildSet('a1', { startedAt: at(0), restTime: 60 }), exerciseId: 'A' },
            { set: buildSet('a2', { restTime: 60 }), exerciseId: 'A' },
        ];
        expect(getWorkoutState([], performing).state).toBe('performing');

        const resting: ExecutionOrderSet[] = [
            {
                set: buildSet('a1', {
                    startedAt: at(0),
                    completedAt: new Date(Date.now()),
                    restTime: 60,
                }),
                exerciseId: 'A',
            },
            { set: buildSet('a2', { restTime: 60 }), exerciseId: 'A' },
        ];
        const info = getWorkoutState([], resting);

        expect(info.state).toBe('resting');
        expect(info.activeRestSet?.id).toBe('a1');
        expect(info.nextSet?.id).toBe('a2');
    });

    test('once rest has run out, the next set is the one to start', () => {
        // Rest that expired 30 seconds ago and was finalized: nothing is
        // resting any more, so the pointer is on the next pending set.
        const order: ExecutionOrderSet[] = [
            {
                set: buildSet('a1', {
                    startedAt: at(0),
                    completedAt: new Date(Date.now() - 90_000),
                    restTime: 60,
                    restCompletedAt: new Date(Date.now() - 30_000),
                    finalRestTime: 60,
                }),
                exerciseId: 'A',
            },
            { set: buildSet('a2'), exerciseId: 'A' },
        ];
        const info = getWorkoutState([], order);

        expect(info.state).toBe('ready');
        expect(info.nextSet?.id).toBe('a2');
    });

    test('a paused rest keeps resting instead of falling through to the next set', () => {
        // Without the pause offset this rest expired long ago and the workout
        // would have started the next set while the user was stopped.
        const order: ExecutionOrderSet[] = [
            {
                set: buildSet('a1', {
                    startedAt: at(0),
                    completedAt: new Date(Date.now() - 600_000),
                    restTime: 60,
                    pausedAt: new Date(Date.now() - 580_000),
                }),
                exerciseId: 'A',
            },
            { set: buildSet('a2'), exerciseId: 'A' },
        ];
        const info = getWorkoutState([], order);

        expect(info.state).toBe('resting');
        expect(info.activeRestSet?.id).toBe('a1');
    });

    test('the final set completing ends the workout, with nothing left to rest for', () => {
        const restingLast: ExecutionOrderSet[] = [
            {
                set: buildSet('a1', {
                    startedAt: at(0),
                    completedAt: new Date(Date.now()),
                    restTime: 60,
                }),
                exerciseId: 'A',
            },
        ];
        expect(getWorkoutState([], restingLast).state).toBe('resting_no_next');

        const done: ExecutionOrderSet[] = [
            {
                set: buildSet('a1', {
                    startedAt: at(0),
                    completedAt: new Date(Date.now()),
                    restTime: 60,
                    restCompletedAt: new Date(Date.now()),
                    finalRestTime: 60,
                }),
                exerciseId: 'A',
            },
        ];
        expect(getWorkoutState([], done).state).toBe('completed');
    });

    test('an already-started next set is not stepped over into the one after it', () => {
        // Two concurrently active sets is the failure mode the transitions
        // guard against; the pointer must stop at the first one.
        const order: ExecutionOrderSet[] = [
            { set: buildSet('a1', { completedAt: new Date(Date.now()) }), exerciseId: 'A' },
            { set: buildSet('a2', { startedAt: at(0) }), exerciseId: 'A' },
            { set: buildSet('a3'), exerciseId: 'A' },
        ];
        const info = getWorkoutState([], order);

        expect(info.state).toBe('performing');
        expect(info.currentSet?.id).toBe('a2');
    });
});
