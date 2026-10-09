import { describe, expect, test } from '@jest/globals';

import { buildChatMessages, buildPlanMessages } from './prompt';

/**
 * What the assistant is told, for the behaviour the client asked for: write
 * the plan instead of interviewing the user, never ask about injuries, read
 * casual replies, and change the running plan when asked to.
 */

const context = {
    profile: {
        fitnessLevel: null,
        goal: 'lose',
        activityLevel: 'moderate',
        sessionsPerWeek: 3,
        sessionMinutes: null,
        bodyWeightKg: 70,
        heightCm: 175,
        dailyCalorieTarget: null,
        dietaryPattern: null,
        allergens: [],
        conditions: [],
        trainingEnvironment: 'gym',
        equipment: [],
        notes: null,
    },
    candidates: [],
    history: [],
    guidance: [],
    weightUnit: 'kg',
    locale: 'en',
} as never;

const systemText = (messages: { role: string; content: string }[]) =>
    messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n');

describe('plan requests', () => {
    const messages = buildPlanMessages(context, 'workout', 'Build me a plan', 7);

    test('defaults to writing the plan rather than asking', () => {
        expect(systemText(messages)).toContain('Default to writing the plan.');
    });

    test('never asks about injuries', () => {
        const text = systemText(messages);

        expect(text).toContain('Do NOT ask about injuries');
        expect(text).not.toMatch(/Any injury, joint issue/);
    });

    test('reads terse, casual replies', () => {
        expect(systemText(messages)).toContain('People write tersely and casually');
    });

    test('lays out training, active rest and full rest days', () => {
        const text = systemText(messages);

        expect(text).toContain('"type": "training" | "active_rest"');
        expect(text).toContain('full rest day');
    });

    test('sends the running plan, so a change starts from it', () => {
        const withPlan = buildPlanMessages(context, 'workout', 'make it harder', 7, [], false, {
            kind: 'workout',
            title: 'Fat loss week',
            summary: null,
            horizonDays: 7,
            workouts: [
                {
                    name: 'Push',
                    dayOffset: 0,
                    type: 'training',
                    exercises: [{ exerciseId: 'a', name: 'Bench Press', sets: 4, reps: 8 }],
                },
                {
                    name: 'Easy walk',
                    dayOffset: 1,
                    type: 'active_rest',
                    exercises: [{ exerciseId: 'b', name: 'Walking', sets: 1 }],
                },
            ],
            meals: [],
            targets: [],
        } as never);
        const text = systemText(withPlan);

        expect(text).toContain('CURRENT PLAN');
        expect(text).toContain('Day 1 · Push (training): Bench Press 4x8');
        expect(text).toContain('Day 2 · Easy walk (active rest): Walking');
    });

    test('no running plan, no current-plan block', () => {
        expect(systemText(messages)).not.toContain('CURRENT PLAN');
    });
});

test('chat no longer sends people to the plan buttons', () => {
    const text = systemText(buildChatMessages(context, [], 'hi'));

    expect(text).not.toContain('use the plan buttons');
    expect(text).toContain('just ask for it');
});
