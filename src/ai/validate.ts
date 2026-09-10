import { AI_PLAN_KINDS, type AiPlanKind } from '@/constants/ai';
import {
    AiError,
    type AiAssessment,
    type AiExerciseCandidate,
    type AiPlanDayTargets,
    type AiPlanExercise,
    type AiPlanMeal,
    type AiPlanMealItem,
    type AiPlanPayload,
    type AiPlanWorkout,
} from '@/types/ai';

/**
 * Deterministic validation of model output.
 *
 * The model proposes; this decides. Prompting reduces constraint violations but does
 * not eliminate them, so anything that reaches the user is re-checked here in ordinary
 * code. Two classes of problem are handled differently:
 *
 *   - Structural nonsense (unknown exercise ids, absurd set counts) is repaired by
 *     dropping the offending item, because a plan missing one movement is still useful.
 *   - A plan with nothing left after repair is rejected, because an empty plan is not.
 */

const MAX_SETS = 20;
const MAX_REPS = 500;
const MAX_REST_SECONDS = 3600;
const MAX_HORIZON_DAYS = 28;
const MAX_WORKOUTS = 28;
const MAX_EXERCISES_PER_WORKOUT = 20;
const MAX_MEAL_ITEMS = 20;
/** More than this stops reading as "what I actually need" and starts reading as a form. */
const MAX_INTAKE_QUESTIONS = 3;

const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

export interface PlanValidationResult {
    payload: AiPlanPayload;
    /** Human-readable notes about what was repaired, for logging and support. */
    repairs: string[];
}

const asFiniteNumber = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
};

const clampInt = (value: number, min: number, max: number): number =>
    Math.min(Math.max(Math.round(value), min), max);

const asPositiveInt = (value: unknown, max: number): number | null => {
    const num = asFiniteNumber(value);
    if (num === null || num <= 0) return null;
    return clampInt(num, 1, max);
};

const asNonNegativeInt = (value: unknown, max: number): number | null => {
    const num = asFiniteNumber(value);
    if (num === null || num < 0) return null;
    return clampInt(num, 0, max);
};

const asTrimmedString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

/**
 * Reasoning models emit their chain of thought around the answer, and not every
 * provider strips it before returning content. These wrappers are removed first so
 * the scan below sees only the payload.
 */
const REASONING_BLOCKS = [
    /<think>[\s\S]*?<\/think>/gi,
    /<thinking>[\s\S]*?<\/thinking>/gi,
    /<reasoning>[\s\S]*?<\/reasoning>/gi,
    /<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi,
];

/**
 * Scans for the first balanced JSON object, tracking string state so that a brace
 * inside a string value does not end the scan early.
 *
 * A naive indexOf('{') / lastIndexOf('}') pair breaks on two common shapes: a reply
 * that appends prose after the object, and a reply containing more than one object.
 */
const findBalancedObject = (text: string): string | null => {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
        const char = text[index];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, index + 1);
        }
    }

    // Unbalanced: the object opened but never closed, which is what a reply cut off
    // at the token ceiling looks like by the time it reaches here.
    return null;
};

/**
 * Recovers the plan object from a completion. Models wrap JSON in markdown fences,
 * prefix it with a sentence, or surround it with reasoning tokens despite being told
 * not to; none of that should fail the turn.
 */
export const extractJsonObject = (raw: string): unknown => {
    let text = raw;
    for (const pattern of REASONING_BLOCKS) {
        text = text.replace(pattern, '');
    }
    text = text.trim();

    if (text.length === 0) {
        throw new AiError('INVALID_RESPONSE', 'The reply contained no content');
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [fenced ? fenced[1].trim() : null, text].filter(
        (entry): entry is string => entry !== null,
    );

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {
            const balanced = findBalancedObject(candidate);
            if (balanced) {
                try {
                    return JSON.parse(balanced);
                } catch {
                    // Try the next candidate.
                }
            }
        }
    }

    // An opening brace with no matching close means the reply was cut short rather
    // than malformed, which points at the token ceiling instead of the prompt.
    if (text.includes('{') && findBalancedObject(text) === null) {
        throw new AiError(
            'TRUNCATED',
            'The plan was cut off before it finished. Raise EXPO_PUBLIC_AI_MAX_TOKENS.',
        );
    }

    throw new AiError('INVALID_RESPONSE', 'The plan was not valid JSON');
};

const validateExercise = (
    value: unknown,
    allowedIds: Map<string, AiExerciseCandidate>,
    repairs: string[],
): AiPlanExercise | null => {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Record<string, unknown>;
    const exerciseId = asTrimmedString(raw.exerciseId);

    if (!exerciseId) return null;

    // The central safety property: an id the model was not offered is discarded.
    const candidate = allowedIds.get(exerciseId);
    if (!candidate) {
        repairs.push(`Dropped unknown exercise id ${exerciseId}`);
        return null;
    }

    const sets = asPositiveInt(raw.sets, MAX_SETS) ?? 3;
    // Warm-up sets are carved out of `sets`, so more of them than there are sets
    // would leave the exercise with no working set at all. Clamped rather than
    // dropped: the movement and its load are still the useful part.
    const warmupSets = Math.min(asNonNegativeInt(raw.warmupSets, MAX_SETS) ?? 0, sets - 1);
    const reps = asPositiveInt(raw.reps, MAX_REPS);
    const weight = asFiniteNumber(raw.weight);
    const timeSeconds = asPositiveInt(raw.timeSeconds, MAX_REST_SECONDS);
    const distance = asFiniteNumber(raw.distance);
    const restSeconds = asNonNegativeInt(raw.restSeconds, MAX_REST_SECONDS);

    return {
        exerciseId,
        name: candidate.name,
        sets,
        warmupSets: Math.max(0, warmupSets),
        reps,
        weight: weight !== null && weight >= 0 ? weight : null,
        timeSeconds,
        distance: distance !== null && distance >= 0 ? distance : null,
        restSeconds,
        notes: asTrimmedString(raw.notes),
    };
};

const validateWorkout = (
    value: unknown,
    allowedIds: Map<string, AiExerciseCandidate>,
    repairs: string[],
): AiPlanWorkout | null => {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Record<string, unknown>;
    const exercisesRaw = Array.isArray(raw.exercises) ? raw.exercises : [];

    const exercises = exercisesRaw
        .slice(0, MAX_EXERCISES_PER_WORKOUT)
        .map((entry) => validateExercise(entry, allowedIds, repairs))
        .filter((entry): entry is AiPlanExercise => entry !== null);

    // A workout with no resolvable exercises cannot be applied to the schedule.
    if (exercises.length === 0) {
        repairs.push('Dropped a workout that had no usable exercises');
        return null;
    }

    return {
        name: asTrimmedString(raw.name) ?? 'Workout',
        dayOffset: asNonNegativeInt(raw.dayOffset, MAX_HORIZON_DAYS) ?? 0,
        focus: asTrimmedString(raw.focus),
        exercises,
    };
};

const validateMealItem = (value: unknown): AiPlanMealItem | null => {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Record<string, unknown>;
    const name = asTrimmedString(raw.name);
    if (!name) return null;

    return {
        name,
        quantity: asTrimmedString(raw.quantity),
        calories: asFiniteNumber(raw.calories),
        proteinG: asFiniteNumber(raw.proteinG),
        carbsG: asFiniteNumber(raw.carbsG),
        fatG: asFiniteNumber(raw.fatG),
    };
};

/**
 * Slot labels the model actually produces, mapped back to the canonical value.
 *
 * The plan is generated in the user's language, and models routinely translate the
 * slot alongside the prose despite being told it is a fixed identifier. Dropping the
 * meal in that case loses the entire plan over a label, so recognise the common forms
 * across the shipped locales instead.
 */
const SLOT_ALIASES: Record<string, AiPlanMeal['slot']> = {
    // English variants
    brunch: 'lunch',
    supper: 'dinner',
    'pre-workout': 'snack',
    'post-workout': 'snack',
    morning: 'breakfast',
    evening: 'dinner',
    // Spanish
    desayuno: 'breakfast',
    almuerzo: 'lunch',
    comida: 'lunch',
    cena: 'dinner',
    merienda: 'snack',
    tentempie: 'snack',
    // Hindi
    नाश्ता: 'breakfast',
    'दोपहर का भोजन': 'lunch',
    'रात का खाना': 'dinner',
    स्नैक: 'snack',
    // Russian
    завтрак: 'breakfast',
    обед: 'lunch',
    ужин: 'dinner',
    перекус: 'snack',
    // Chinese
    早餐: 'breakfast',
    午餐: 'lunch',
    晚餐: 'dinner',
    加餐: 'snack',
    零食: 'snack',
};

const resolveSlot = (raw: unknown): AiPlanMeal['slot'] | null => {
    const value = asTrimmedString(raw)?.toLowerCase();
    if (!value) return null;

    if (MEAL_SLOTS.has(value)) return value as AiPlanMeal['slot'];

    return SLOT_ALIASES[value] ?? null;
};

const validateMeal = (value: unknown, repairs: string[]): AiPlanMeal | null => {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Record<string, unknown>;

    const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
    const items = itemsRaw
        .slice(0, MAX_MEAL_ITEMS)
        .map(validateMealItem)
        .filter((entry): entry is AiPlanMealItem => entry !== null);

    if (items.length === 0) {
        repairs.push('Dropped a meal that had no usable items');
        return null;
    }

    // An unrecognised label is a presentation problem; the food itself is still
    // useful. Fall back rather than discarding the meal.
    const resolved = resolveSlot(raw.slot);
    if (resolved === null) {
        repairs.push(`Unrecognised meal slot "${asTrimmedString(raw.slot) ?? 'missing'}"`);
    }

    return {
        slot: resolved ?? 'snack',
        dayOffset: asNonNegativeInt(raw.dayOffset, MAX_HORIZON_DAYS) ?? 0,
        items,
    };
};

const validateTargets = (value: unknown): AiPlanDayTargets | null => {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Record<string, unknown>;

    return {
        dayOffset: asNonNegativeInt(raw.dayOffset, MAX_HORIZON_DAYS) ?? 0,
        calories: asFiniteNumber(raw.calories),
        proteinG: asFiniteNumber(raw.proteinG),
        carbsG: asFiniteNumber(raw.carbsG),
        fatG: asFiniteNumber(raw.fatG),
    };
};

/**
 * The entry point for a plan request's response, now that it can answer with
 * three different shapes instead of always being a plan — see
 * `ASSESSMENT_SCHEMA_HINT` in src/ai/prompt.ts for what asks for each one.
 *
 * `status` is checked before anything else touches the object, and on
 * purpose: a `need_info` or `stop` reply has none of `workouts`/`meals`, and
 * routing it into `validatePlanPayload` first would fail it as "a plan with
 * no usable workouts" rather than recognising it for what it is. Anything
 * that is not one of the two special shapes — including a model that ignored
 * the instruction and returned a plan directly — falls through to
 * `validatePlanPayload` exactly as it did before this existed, which is what
 * keeps this backward compatible with a model that never learns the new
 * protocol.
 */
export const parseAssessment = (
    input: unknown,
    expectedKind: AiPlanKind,
    candidates: AiExerciseCandidate[],
): AiAssessment => {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        const raw = input as Record<string, unknown>;
        const status = asTrimmedString(raw.status);

        if (status === 'need_info') {
            const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];
            const questions = questionsRaw
                .map((entry) => asTrimmedString(entry))
                .filter((entry): entry is string => entry !== null)
                .slice(0, MAX_INTAKE_QUESTIONS);

            if (questions.length === 0) {
                throw new AiError('INVALID_RESPONSE', 'need_info response carried no questions');
            }

            return { status: 'need_info', questions };
        }

        if (status === 'stop') {
            const message = asTrimmedString(raw.message);

            if (!message) {
                throw new AiError('INVALID_RESPONSE', 'stop response carried no message');
            }

            return { status: 'stop', message };
        }
    }

    const { payload, repairs } = validatePlanPayload(input, expectedKind, candidates);
    return { status: 'ready', payload, repairs };
};

export const validatePlanPayload = (
    input: unknown,
    expectedKind: AiPlanKind,
    candidates: AiExerciseCandidate[],
): PlanValidationResult => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new AiError('INVALID_RESPONSE', 'The plan was not an object');
    }

    const raw = input as Record<string, unknown>;
    const repairs: string[] = [];

    const allowedIds = new Map(candidates.map((candidate) => [candidate.id, candidate]));

    const rawKind = asTrimmedString(raw.kind) as AiPlanKind | null;
    const kind = rawKind && AI_PLAN_KINDS.includes(rawKind) ? rawKind : expectedKind;
    if (kind !== expectedKind) {
        repairs.push(`Model returned kind "${kind}"; expected "${expectedKind}"`);
    }

    const workoutsRaw = Array.isArray(raw.workouts) ? raw.workouts : [];
    const workouts = workoutsRaw
        .slice(0, MAX_WORKOUTS)
        .map((entry) => validateWorkout(entry, allowedIds, repairs))
        .filter((entry): entry is AiPlanWorkout => entry !== null);

    const mealsRaw = Array.isArray(raw.meals) ? raw.meals : [];
    const meals = mealsRaw
        .map((entry) => validateMeal(entry, repairs))
        .filter((entry): entry is AiPlanMeal => entry !== null);

    const targetsRaw = Array.isArray(raw.targets) ? raw.targets : [];
    const targets = targetsRaw
        .map(validateTargets)
        .filter((entry): entry is AiPlanDayTargets => entry !== null);

    // Reject rather than repair when the plan has no substance for what was asked.
    const needsWorkouts = expectedKind === 'workout' || expectedKind === 'combined';
    const needsMeals = expectedKind === 'nutrition' || expectedKind === 'combined';

    if (needsWorkouts && workouts.length === 0) {
        throw new AiError('INVALID_RESPONSE', 'The plan contained no usable workouts');
    }
    if (needsMeals && meals.length === 0) {
        throw new AiError('INVALID_RESPONSE', 'The plan contained no usable meals');
    }

    const impliedHorizon = Math.max(
        1,
        ...workouts.map((workout) => workout.dayOffset + 1),
        ...meals.map((meal) => meal.dayOffset + 1),
    );

    const declaredHorizon = asPositiveInt(raw.horizonDays, MAX_HORIZON_DAYS);

    return {
        payload: {
            kind: expectedKind,
            title: asTrimmedString(raw.title) ?? 'Your plan',
            summary: asTrimmedString(raw.summary),
            horizonDays: Math.max(declaredHorizon ?? impliedHorizon, impliedHorizon),
            workouts,
            meals,
            targets,
        },
        repairs,
    };
};
