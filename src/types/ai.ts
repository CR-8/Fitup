import type { AiPlanKind } from '@/constants/ai';

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
}

export interface AiRequestContext {
    profile: AiProfileContext;
    candidates: AiExerciseCandidate[];
    history: AiHistoryEntry[];
    locale: string;
    weightUnit: string;
}

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
