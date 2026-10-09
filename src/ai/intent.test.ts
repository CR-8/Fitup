import { describe, expect, test } from '@jest/globals';

import { detectPlanRequest } from './intent';

/**
 * What typed into the AI tab is a plan request, and what is conversation.
 *
 * The two mistakes cost different things: a missed request goes to chat, which
 * says how to ask; a false one spends one of the month's plans. So the
 * "conversation" cases matter as much as the "request" ones.
 */

describe('plan requests', () => {
    test.each([
        ['make me a 4 day split', 'workout'],
        ['Build me a training plan for the week', 'workout'],
        ['need a full body routine', 'workout'],
        ['gimme a new plan pls', 'workout'],
        ['ppl 5 days plan', 'workout'],
        ['3x a week plan, gym', 'workout'],
        ['workout plan bana do', 'workout'],
        ['mujhe plan chahiye', 'workout'],
        ['can you make me a workout plan?', 'workout'],
        ['give me a diet', 'nutrition'],
        ['need a meal plan for 3 days', 'nutrition'],
        ['make me a food chart', 'nutrition'],
        ['build a training plan and a diet for fat loss', 'combined'],
    ])('"%s" is a %s plan request', (text, kind) => {
        expect(detectPlanRequest(text)).toEqual({ kind, revision: false });
    });
});

describe('conversation, not a request', () => {
    test.each([
        'how does progressive overload work?',
        'what is a push pull legs split',
        'should I change my grip on bench?',
        'I train 3 days a week',
        'I want to eat better',
        "I don't want a new plan",
        'thanks!',
        'my knees hurt when I change direction',
        '',
    ])('"%s"', (text) => {
        expect(detectPlanRequest(text, { hasActivePlan: true })).toBeNull();
    });
});

describe('changing the running plan', () => {
    test.each([
        ['make it harder', 'workout'],
        ['swap squats for lunges', 'workout'],
        ['can you make my plan easier', 'workout'],
        ['add cardio', 'workout'],
        ['add food to it', 'combined'],
    ])('"%s" revises the plan', (text, kind) => {
        expect(detectPlanRequest(text, { hasActivePlan: true })).toEqual({ kind, revision: true });
    });

    test('with no plan running there is nothing to revise', () => {
        expect(detectPlanRequest('make it harder', { hasActivePlan: false })).toBeNull();
    });
});
