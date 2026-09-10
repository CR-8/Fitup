import type { AiPlanKind } from '@/constants/ai';
import type { FitnessLevel } from '@/helpers/fitness-level';

/**
 * The plan shape the model is asked to return.
 *
 * Exercises are referenced by catalogue id, never by name. The model selects from a
 * candidate list supplied in the prompt; names, instructions, and media are joined
 * from the local database when the plan is rendered. This removes a whole class of
 * failure — the model cannot invent an exercise that does not exist, because it never
 * writes one.
 *
 * Foods carry their own macros because there is no food catalogue to join against.
 * Those values are model-authored and are labelled as estimates in the UI.
 */

export interface AiPlanExercise {
    exerciseId: string;
    /** Echoed back by the model for readability; the local row is authoritative. */
    name?: string;
    sets: number;
    /**
     * How many of `sets` are ramp-up rather than working sets.
     *
     * Counted into `sets`, not added to it, so the total the user sees is the
     * number the model wrote. The first `warmupSets` of the exercise are
     * created as `warmup`, which is a set type the schema already carries and
     * the stats already exclude from working volume.
     */
    warmupSets?: number | null;
    reps?: number | null;
    weight?: number | null;
    timeSeconds?: number | null;
    distance?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
}

export interface AiPlanWorkout {
    name: string;
    /** Zero-based offset from the plan start, so a plan is not pinned to a date. */
    dayOffset: number;
    focus?: string | null;
    exercises: AiPlanExercise[];
}

export interface AiPlanMealItem {
    name: string;
    quantity?: string | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
}

export interface AiPlanMeal {
    slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    dayOffset: number;
    items: AiPlanMealItem[];
}

export interface AiPlanDayTargets {
    dayOffset: number;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
}

export interface AiPlanPayload {
    kind: AiPlanKind;
    title: string;
    summary?: string | null;
    horizonDays: number;
    workouts: AiPlanWorkout[];
    meals: AiPlanMeal[];
    targets: AiPlanDayTargets[];
}

/** Context assembled locally and sent with the request. */
export interface AiProfileContext {
    goal: string | null;
    activityLevel: string | null;
    sessionsPerWeek: number | null;
    sessionMinutes: number | null;
    dietaryPattern: string | null;
    allergens: string[];
    conditions: string[];
    equipment: string[];
    dailyCalorieTarget: number | null;
    bodyWeightKg: number | null;
    heightCm: number | null;
    notes: string | null;
    /**
     * Computed by `src/helpers/fitness-level.ts` from real training history,
     * never asked for and never model-estimated — see that file for why. Null
     * before a first workout is completed, which is a real state and not a
     * missing one: there is nothing yet to compute a level from.
     */
    fitnessLevel: FitnessLevel | null;
}

export interface AiExerciseCandidate {
    id: string;
    name: string;
    category: string;
    equipment: string[];
    primaryMuscleGroups: string[];
    tracking: string[];
}

export interface AiHistoryEntry {
    name: string;
    completedAt: number;
    exerciseNames: string[];
    /**
     * What the user answered when they ended the session. Null for anything
     * completed before the question existed, or dismissed without an answer.
     */
    difficulty: 'easy' | 'medium' | 'hard' | null;
}

/**
 * Reviewed, human-written guidance for one condition the user declared.
 *
 * Comes from `condition_guidance` via `supabase/functions/syn`'s retrieval
 * call — see supabase/migrations/0005. `avoid` is enforced there as a hard SQL
 * filter over the candidate list before it ever reaches the prompt; it is
 * carried here too because the prompt states it again as an absolute rule
 * (src/ai/prompt.ts), which is the belt to the filter's suspenders — a model
 * that reasons past the missing candidates should still see the instruction
 * not to substitute something equivalent.
 */
export interface AiConditionGuidance {
    condition: string;
    title: string;
    body: string;
}

export interface AiRequestContext {
    profile: AiProfileContext;
    candidates: AiExerciseCandidate[];
    history: AiHistoryEntry[];
    /**
     * Empty when retrieval is not configured or the call failed — see
     * `buildCandidates` in src/crud/ai/index.ts. The prompt degrades to
     * exactly its pre-retrieval behaviour in that case: no CONDITION GUIDANCE
     * section, and the plain unranked candidate list it already had.
     */
    guidance: AiConditionGuidance[];
    locale: string;
    weightUnit: string;
}

/** One of the two things a plan request can answer with instead of a plan. */
export interface AiIntakeQuestions {
    status: 'need_info';
    questions: string[];
}

/** The model judged this is not something to program around — see src/ai/prompt.ts. */
export interface AiIntakeStop {
    status: 'stop';
    message: string;
}

export interface AiPlanReady {
    status: 'ready';
    payload: AiPlanPayload;
    repairs: string[];
}

export type AiAssessment = AiIntakeQuestions | AiIntakeStop | AiPlanReady;

export type AiFailureCode =
    | 'DISABLED'
    | 'NO_INTERNET'
    | 'TIMEOUT'
    | 'RATE_LIMIT'
    | 'AUTH'
    | 'QUOTA'
    | 'INVALID_RESPONSE'
    /** The reply hit the token ceiling and was cut off mid-structure. */
    | 'TRUNCATED'
    | 'PROVIDER'
    | 'UNKNOWN';

export class AiError extends Error {
    code: AiFailureCode;
    status?: number;

    constructor(code: AiFailureCode, message?: string, status?: number) {
        super(message ?? code);
        this.name = 'AiError';
        this.code = code;
        this.status = status;
    }
}
