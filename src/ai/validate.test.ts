import { describe, expect, test } from '@jest/globals';

import { extractJsonObject, validatePlanPayload } from './validate';
import { AiError, type AiExerciseCandidate } from '@/types/ai';

const candidates: AiExerciseCandidate[] = [
    {
        id: 'exerciseAlpha00000001',
        name: 'Barbell Bench Press',
        category: 'strength',
        equipment: ['barbell'],
        primaryMuscleGroups: ['chest'],
        tracking: ['weight', 'reps'],
    },
    {
        id: 'exerciseBravo00000001',
        name: 'Bodyweight Squat',
        category: 'strength',
        equipment: [],
        primaryMuscleGroups: ['quadriceps'],
        tracking: ['reps'],
    },
];

/** Runs `fn` and returns the AiError code it threw, so failures assert on the cause. */
const getFailureCode = (fn: () => unknown): string | null => {
    try {
        fn();
    } catch (error) {
        return error instanceof AiError ? error.code : null;
    }

    return null;
};

const workoutPlan = (overrides: Record<string, unknown> = {}) => ({
    kind: 'workout',
    title: 'Push week',
    summary: 'Three sessions.',
    horizonDays: 7,
    workouts: [
        {
            name: 'Upper body',
            dayOffset: 0,
            exercises: [{ exerciseId: 'exerciseAlpha00000001', sets: 4, reps: 8, restSeconds: 90 }],
        },
    ],
    meals: [],
    targets: [],
    ...overrides,
});

describe('extractJsonObject', () => {
    test('parses a bare JSON object', () => {
        expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    });

    test('recovers an object wrapped in a markdown fence', () => {
        expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    test('recovers an object preceded by prose', () => {
        expect(extractJsonObject('Here is your plan:\n{"a":1}')).toEqual({ a: 1 });
    });

    test('throws a typed error when there is no object', () => {
        expect(() => extractJsonObject('no json at all')).toThrow(AiError);
    });

    test('strips reasoning tokens emitted by reasoning models', () => {
        const raw = '<think>Let me plan this out step by step.</think>\n{"a":1}';

        expect(extractJsonObject(raw)).toEqual({ a: 1 });
    });

    test('strips <thinking> and <reasoning> variants', () => {
        expect(extractJsonObject('<thinking>hmm</thinking>{"a":1}')).toEqual({ a: 1 });
        expect(extractJsonObject('<reasoning>hmm</reasoning>{"a":1}')).toEqual({ a: 1 });
    });

    test('ignores prose that follows the object', () => {
        const raw = '{"a":1}\n\nLet me know if you want me to adjust anything!';

        expect(extractJsonObject(raw)).toEqual({ a: 1 });
    });

    test('does not stop at a brace inside a string value', () => {
        const raw = '{"note":"use a } shape","a":1} trailing text';

        expect(extractJsonObject(raw)).toEqual({ note: 'use a } shape', a: 1 });
    });

    test('does not stop at an escaped quote inside a string value', () => {
        const raw = '{"note":"say \\"go\\" now","a":1}';

        expect(extractJsonObject(raw)).toEqual({ note: 'say "go" now', a: 1 });
    });

    test('handles nested objects rather than closing at the first brace', () => {
        const raw = 'Here you go:\n{"outer":{"inner":{"deep":1}},"a":2}';

        expect(extractJsonObject(raw)).toEqual({ outer: { inner: { deep: 1 } }, a: 2 });
    });

    test('reports a cut-off reply as TRUNCATED, not as malformed JSON', () => {
        // What a plan hitting the token ceiling actually looks like. Distinguishing
        // this from bad JSON is what points at the token ceiling rather than the prompt.
        const raw = '{"kind":"workout","workouts":[{"name":"Upper","exercises":[{"exerc';

        expect(getFailureCode(() => extractJsonObject(raw))).toBe('TRUNCATED');
    });

    test('reports genuinely absent JSON as INVALID_RESPONSE', () => {
        expect(getFailureCode(() => extractJsonObject('I cannot help with that.'))).toBe(
            'INVALID_RESPONSE',
        );
    });

    test('recovers a fenced object that also carries reasoning tokens', () => {
        const raw = '<think>plan</think>\n```json\n{"a":1}\n```\nDone.';

        expect(extractJsonObject(raw)).toEqual({ a: 1 });
    });
});

describe('validatePlanPayload', () => {
    test('accepts a well-formed workout plan', () => {
        const { payload, repairs } = validatePlanPayload(workoutPlan(), 'workout', candidates);

        expect(repairs).toHaveLength(0);
        expect(payload.workouts).toHaveLength(1);
        expect(payload.workouts[0].exercises[0].exerciseId).toBe('exerciseAlpha00000001');
    });

    test('resolves the exercise name from the catalogue, not from model output', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [
                        {
                            exerciseId: 'exerciseAlpha00000001',
                            name: 'Totally Wrong Name',
                            sets: 3,
                            reps: 10,
                        },
                    ],
                },
            ],
        });

        const { payload } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.workouts[0].exercises[0].name).toBe('Barbell Bench Press');
    });

    test('drops an exercise id that was never offered to the model', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [
                        { exerciseId: 'hallucinatedId0000001', sets: 3, reps: 10 },
                        { exerciseId: 'exerciseBravo00000001', sets: 3, reps: 10 },
                    ],
                },
            ],
        });

        const { payload, repairs } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.workouts[0].exercises).toHaveLength(1);
        expect(payload.workouts[0].exercises[0].exerciseId).toBe('exerciseBravo00000001');
        expect(repairs.join(' ')).toContain('hallucinatedId0000001');
    });

    test('rejects a workout plan whose exercises are all unknown', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [{ exerciseId: 'hallucinatedId0000001', sets: 3, reps: 10 }],
                },
            ],
        });

        expect(() => validatePlanPayload(plan, 'workout', candidates)).toThrow(AiError);
    });

    test('rejects a workout plan with no workouts', () => {
        expect(() =>
            validatePlanPayload(workoutPlan({ workouts: [] }), 'workout', candidates),
        ).toThrow(AiError);
    });

    test('rejects a nutrition plan with no meals', () => {
        const plan = {
            kind: 'nutrition',
            title: 'Cut',
            horizonDays: 7,
            workouts: [],
            meals: [],
            targets: [],
        };

        expect(() => validatePlanPayload(plan, 'nutrition', candidates)).toThrow(AiError);
    });

    test('clamps absurd set and rep counts rather than failing', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [{ exerciseId: 'exerciseAlpha00000001', sets: 9999, reps: 99999 }],
                },
            ],
        });

        const { payload } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.workouts[0].exercises[0].sets).toBe(20);
        expect(payload.workouts[0].exercises[0].reps).toBe(500);
    });

    test('defaults a missing set count instead of producing NaN', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [{ exerciseId: 'exerciseAlpha00000001', reps: 10 }],
                },
            ],
        });

        const { payload } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.workouts[0].exercises[0].sets).toBe(3);
    });

    test('keeps warm-up sets inside the set count the model asked for', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [
                        {
                            exerciseId: 'exerciseAlpha00000001',
                            sets: 5,
                            warmupSets: 2,
                            reps: 5,
                        },
                    ],
                },
            ],
        });

        const { payload } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.workouts[0].exercises[0].sets).toBe(5);
        expect(payload.workouts[0].exercises[0].warmupSets).toBe(2);
    });

    test('leaves at least one working set when every set is called a warm-up', () => {
        const plan = workoutPlan({
            workouts: [
                {
                    name: 'Upper body',
                    dayOffset: 0,
                    exercises: [
                        {
                            exerciseId: 'exerciseAlpha00000001',
                            sets: 3,
                            warmupSets: 9,
                            reps: 5,
                        },
                    ],
                },
            ],
        });

        const { payload } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.workouts[0].exercises[0].warmupSets).toBe(2);
    });

    test('treats a missing warm-up count as none rather than NaN', () => {
        const { payload } = validatePlanPayload(workoutPlan(), 'workout', candidates);

        expect(payload.workouts[0].exercises[0].warmupSets).toBe(0);
    });

    test('forces the returned kind to the requested kind', () => {
        const { payload, repairs } = validatePlanPayload(
            workoutPlan({ kind: 'combined' }),
            'workout',
            candidates,
        );

        expect(payload.kind).toBe('workout');
        expect(repairs.join(' ')).toContain('combined');
    });

    const nutritionPlan = (meals: unknown[]) => ({
        kind: 'nutrition',
        title: 'Cut',
        horizonDays: 1,
        workouts: [],
        meals,
        targets: [],
    });

    test('maps a known slot alias rather than dropping the meal', () => {
        const { payload } = validatePlanPayload(
            nutritionPlan([{ slot: 'brunch', dayOffset: 0, items: [{ name: 'Eggs' }] }]),
            'nutrition',
            candidates,
        );

        expect(payload.meals).toHaveLength(1);
        expect(payload.meals[0].slot).toBe('lunch');
    });

    test('accepts slots translated into the plan language', () => {
        // The plan is generated in the user's language and models translate the slot
        // along with the prose. Before this was handled, every meal was discarded and
        // the whole nutrition plan failed validation.
        const translated = [
            { slot: 'Desayuno', dayOffset: 0, items: [{ name: 'Avena' }] },
            { slot: 'завтрак', dayOffset: 1, items: [{ name: 'Овсянка' }] },
            { slot: '早餐', dayOffset: 2, items: [{ name: '燕麦' }] },
            { slot: 'नाश्ता', dayOffset: 3, items: [{ name: 'ओट्स' }] },
        ];

        const { payload } = validatePlanPayload(nutritionPlan(translated), 'nutrition', candidates);

        expect(payload.meals).toHaveLength(4);
        expect(payload.meals.every((meal) => meal.slot === 'breakfast')).toBe(true);
    });

    test('falls back to snack for a slot it cannot resolve, keeping the food', () => {
        const { payload, repairs } = validatePlanPayload(
            nutritionPlan([
                {
                    slot: 'second elevenses',
                    dayOffset: 0,
                    items: [{ name: 'Nuts', calories: 200 }],
                },
            ]),
            'nutrition',
            candidates,
        );

        expect(payload.meals).toHaveLength(1);
        expect(payload.meals[0].slot).toBe('snack');
        expect(payload.meals[0].items[0].name).toBe('Nuts');
        expect(repairs.join(' ')).toContain('second elevenses');
    });

    test('still drops a meal that has no usable items', () => {
        const { payload, repairs } = validatePlanPayload(
            nutritionPlan([
                { slot: 'breakfast', dayOffset: 0, items: [{ calories: 300 }] },
                { slot: 'lunch', dayOffset: 0, items: [{ name: 'Rice' }] },
            ]),
            'nutrition',
            candidates,
        );

        expect(payload.meals).toHaveLength(1);
        expect(payload.meals[0].slot).toBe('lunch');
        expect(repairs.join(' ')).toContain('no usable items');
    });

    test('derives the horizon from content when the model understates it', () => {
        const plan = workoutPlan({
            horizonDays: 1,
            workouts: [
                {
                    name: 'Day one',
                    dayOffset: 0,
                    exercises: [{ exerciseId: 'exerciseAlpha00000001', sets: 3, reps: 8 }],
                },
                {
                    name: 'Day five',
                    dayOffset: 4,
                    exercises: [{ exerciseId: 'exerciseBravo00000001', sets: 3, reps: 8 }],
                },
            ],
        });

        const { payload } = validatePlanPayload(plan, 'workout', candidates);

        expect(payload.horizonDays).toBe(5);
    });

    test('rejects a non-object payload', () => {
        expect(() => validatePlanPayload('nope', 'workout', candidates)).toThrow(AiError);
        expect(() => validatePlanPayload([1, 2], 'workout', candidates)).toThrow(AiError);
    });
});
