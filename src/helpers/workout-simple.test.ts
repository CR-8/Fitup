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
