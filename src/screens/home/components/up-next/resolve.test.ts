import { describe, expect, test } from '@jest/globals';

import { resolveUpNext } from './resolve';
import { greetingKeyForHour } from '../greeting/salutation';

/**
 * The card at the top of Home offers exactly one thing to do, and which one is
 * a priority order rather than a mode. Getting it wrong fails quietly — you are
 * simply invited to start the wrong workout, or to plan a new one while an old
 * one is still running.
 */

const workout = (id: string) => ({ id, name: id }) as never;

describe('what the home card offers', () => {
    test('a running workout outranks everything', () => {
        const state = resolveUpNext([workout('running')], [workout('planned')]);

        expect(state).toEqual({ kind: 'resume', workout: workout('running') });
    });

    test('with nothing running, the first planned workout is next', () => {
        const state = resolveUpNext([], [workout('a'), workout('b')]);

        expect(state).toEqual({ kind: 'start', workout: workout('a') });
    });

    test('with nothing running and nothing planned, it invites you to create', () => {
        expect(resolveUpNext([], [])).toEqual({ kind: 'create' });
    });

    // `getPlannedWorkouts` sorts newest first, and the card takes the head of
    // that list. This pins that it takes the head rather than the tail.
    test('the first planned workout is taken, not the last', () => {
        const state = resolveUpNext([], [workout('newest'), workout('older')]);

        expect(state).toMatchObject({ workout: { id: 'newest' } });
    });
});

describe('the greeting', () => {
    test.each([
        [0, 'morning'],
        [8, 'morning'],
        [11, 'morning'],
        [12, 'afternoon'],
        [17, 'afternoon'],
        [18, 'evening'],
        [23, 'evening'],
    ])('%i:00 is %s', (hour, expected) => {
        expect(greetingKeyForHour(hour)).toBe(expected);
    });
});
