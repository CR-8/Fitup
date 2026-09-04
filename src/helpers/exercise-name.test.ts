import { describe, expect, test } from '@jest/globals';

import { exerciseDisplayName, toTitleCase } from '@/helpers/exercise-name';

/**
 * Every case below is taken from the shipped catalogue, not invented. The
 * counts are how many of the 1,324 names contain that word, which is why each
 * one earned a rule rather than being left to naive capitalisation.
 */

describe('title casing a catalogue name', () => {
    test('the plain case', () => {
        expect(toTitleCase('kettlebell two arm clean')).toBe('Kettlebell Two Arm Clean');
    });

    test.each([
        ['cable overhead curl', 'Cable Overhead Curl'],
        ['kettlebell alternating press', 'Kettlebell Alternating Press'],
        ['lever seated reverse fly', 'Lever Seated Reverse Fly'],
    ])('%s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    // on 69 · to 13 · and 11 · the 7 · in 4 · a 4 · of 3 · off 2
    test.each([
        [
            'exercise ball back extension with rotation',
            'Exercise Ball Back Extension with Rotation',
        ],
        ['low glute bridge on floor', 'Low Glute Bridge on Floor'],
        ['push-up close-grip off dumbbell', 'Push-Up Close-Grip off Dumbbell'],
    ])('minor words stay down: %s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    test('a minor word still leads when it opens the name', () => {
        expect(toTitleCase('on your knees push-up')).toBe('On Your Knees Push-Up');
    });

    // ez 20 · jm 2
    test.each([
        ['ez barbell curl', 'EZ Barbell Curl'],
        ['barbell jm bench press', 'Barbell JM Bench Press'],
        ['ez-bar close-grip bench press', 'EZ-Bar Close-Grip Bench Press'],
    ])('acronyms are uppercased: %s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    test.each([
        ['lever t-bar reverse grip row', 'Lever T-Bar Reverse Grip Row'],
        ['cable standing twist row (v-bar)', 'Cable Standing Twist Row (V-Bar)'],
    ])('a lone letter naming equipment is capitalised: %s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    test.each([
        ['reverse grip pull-up', 'Reverse Grip Pull-Up'],
        ['push-up on lower arms', 'Push-Up on Lower Arms'],
    ])('hyphenated words capitalise each part: %s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    test('a minor word inside a hyphenation stays down', () => {
        expect(toTitleCase('elbow-to-knee')).toBe('Elbow-to-Knee');
    });

    // "v. 2" marks a variant. 40 names carry it, and "V. 2" reads like a heading.
    test.each([
        ['push-up (wall) v. 2', 'Push-Up (Wall) v. 2'],
        ['run (equipment)', 'Run (Equipment)'],
    ])('%s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    test('a bracket capitalises the word it opens, minor or not', () => {
        expect(toTitleCase('dumbbell one arm reverse fly (with support)')).toBe(
            'Dumbbell One Arm Reverse Fly (With Support)',
        );
        expect(toTitleCase('cable high row (kneeling)')).toBe('Cable High Row (Kneeling)');
    });

    test.each([
        ['arms apart circular toe touch (male)', 'Arms Apart Circular Toe Touch (Male)'],
        ['45° leg press', '45° Leg Press'],
        ['180 twist jump', '180 Twist Jump'],
    ])('numbers and symbols keep their shape: %s', (input, expected) => {
        expect(toTitleCase(input)).toBe(expected);
    });

    test('already-capitalised text is left alone', () => {
        expect(toTitleCase('Barbell Bench Press')).toBe('Barbell Bench Press');
    });

    test.each([[''], ['   ']])('an empty name does not throw', (input) => {
        expect(() => toTitleCase(input)).not.toThrow();
    });
});

describe('choosing whether to reformat at all', () => {
    const catalogue = { name: 'kettlebell two arm clean', userId: '__fitup__' };

    test('a catalogue exercise is capitalised', () => {
        expect(exerciseDisplayName(catalogue)).toBe('Kettlebell Two Arm Clean');
    });

    // The one that matters: their capitals are a decision, not an oversight.
    test.each([['5x5 DB press'], ['my leg day'], ['RDL (heavy)'], ['squat AMRAP']])(
        'a name the user wrote is untouched: %s',
        (name) => {
            expect(exerciseDisplayName({ name, userId: 'OuhXmyJanSkzowMH14u7J' })).toBe(name);
        },
    );

    test('a missing owner is treated as the user, not the catalogue', () => {
        expect(exerciseDisplayName({ name: 'my thing', userId: null })).toBe('my thing');
        expect(exerciseDisplayName({ name: 'my thing' })).toBe('my thing');
    });
});
