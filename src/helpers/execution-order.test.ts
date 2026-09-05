import { describe, expect, test } from '@jest/globals';

import { getExecutionOrderSets } from './execution-order';

/**
 * The order sets are actually performed in.
 *
 * Everything downstream — which set is next, what the timer previews, which
 * notification is scheduled, what the watch shows — walks this list, so a
 * superset that flattened exercise-by-exercise would quietly tell the user to
 * do all three sets of A before touching B. That is the whole point of a
 * superset, and it fails silently.
 */

const buildSet = (id: string, order: number, round?: number) =>
    ({ id, order, round: round ?? null }) as never;

const exercise = (id: string, sets: unknown[], groupId?: string) =>
    ({ id, groupId: groupId ?? null, sets }) as never;

const details = (groups: { id: string; type: string }[]) =>
    ({ groups: groups.map((group) => ({ group })) }) as never;

const ids = (result: { set: { id: string } }[]) => result.map((entry) => entry.set.id);

describe('linear exercises', () => {
    test('all sets of one exercise, then the next', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0), buildSet('a2', 1)]),
                exercise('B', [buildSet('b1', 0), buildSet('b2', 1)]),
            ],
            details([]),
        );

        expect(ids(result)).toEqual(['a1', 'a2', 'b1', 'b2']);
    });

    test('a group typed single stays linear', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0), buildSet('a2', 1)], 'g1'),
                exercise('B', [buildSet('b1', 0)], 'g1'),
            ],
            details([{ id: 'g1', type: 'single' }]),
        );

        expect(ids(result)).toEqual(['a1', 'a2', 'b1']);
    });
});

describe('supersets, trisets and circuits', () => {
    test('a superset alternates round by round', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0), buildSet('a2', 1)], 'g1'),
                exercise('B', [buildSet('b1', 0), buildSet('b2', 1)], 'g1'),
            ],
            details([{ id: 'g1', type: 'superset' }]),
        );

        expect(ids(result)).toEqual(['a1', 'b1', 'a2', 'b2']);
    });

    test('a triset rotates through all three before repeating', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0), buildSet('a2', 1)], 'g1'),
                exercise('B', [buildSet('b1', 0), buildSet('b2', 1)], 'g1'),
                exercise('C', [buildSet('c1', 0), buildSet('c2', 1)], 'g1'),
            ],
            details([{ id: 'g1', type: 'triset' }]),
        );

        expect(ids(result)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'c2']);
    });

    test('a circuit behaves the same way', () => {
        const result = getExecutionOrderSets(
            [exercise('A', [buildSet('a1', 0)], 'g1'), exercise('B', [buildSet('b1', 0)], 'g1')],
            details([{ id: 'g1', type: 'circuit' }]),
        );

        expect(ids(result)).toEqual(['a1', 'b1']);
    });

    test('a linear exercise after a superset picks up where the group left off', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0), buildSet('a2', 1)], 'g1'),
                exercise('B', [buildSet('b1', 0), buildSet('b2', 1)], 'g1'),
                exercise('C', [buildSet('c1', 0), buildSet('c2', 1)]),
            ],
            details([{ id: 'g1', type: 'superset' }]),
        );

        expect(ids(result)).toEqual(['a1', 'b1', 'a2', 'b2', 'c1', 'c2']);
    });
});

describe('uneven set counts', () => {
    test('the shorter exercise drops out and the longer one finishes alone', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0), buildSet('a2', 1), buildSet('a3', 2)], 'g1'),
                exercise('B', [buildSet('b1', 0)], 'g1'),
            ],
            details([{ id: 'g1', type: 'superset' }]),
        );

        expect(ids(result)).toEqual(['a1', 'b1', 'a2', 'a3']);
    });
});

describe('rounds', () => {
    test('explicit rounds pair sets across exercises rather than positions', () => {
        // B has no set for round 0, so round 1 pairs a2 with b2 — which
        // positional matching would have got wrong.
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a1', 0, 0), buildSet('a2', 1, 1)], 'g1'),
                exercise('B', [buildSet('b2', 0, 1)], 'g1'),
            ],
            details([{ id: 'g1', type: 'superset' }]),
        );

        expect(ids(result)).toEqual(['a1', 'a2', 'b2']);
    });

    test('rounds are followed even when they arrive out of order', () => {
        const result = getExecutionOrderSets(
            [
                exercise('A', [buildSet('a2', 0, 1), buildSet('a1', 1, 0)], 'g1'),
                exercise('B', [buildSet('b1', 0, 0), buildSet('b2', 1, 1)], 'g1'),
            ],
            details([{ id: 'g1', type: 'superset' }]),
        );

        expect(ids(result)).toEqual(['a1', 'b1', 'a2', 'b2']);
    });
});

describe('nothing to order', () => {
    test('no exercises, or no details, yields nothing', () => {
        expect(getExecutionOrderSets([], details([]))).toEqual([]);
        expect(getExecutionOrderSets([exercise('A', [buildSet('a1', 0)])], null)).toEqual([]);
    });

    test('an exercise with no sets contributes nothing', () => {
        const result = getExecutionOrderSets(
            [exercise('A', []), exercise('B', [buildSet('b1', 0)])],
            details([]),
        );

        expect(ids(result)).toEqual(['b1']);
    });
});
