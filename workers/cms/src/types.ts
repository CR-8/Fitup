export interface Env {
    DB: D1Database;
    ADMIN_USER: string;
    ADMIN_PASSWORD: string;
    SUPABASE_URL: string;
    /**
     * The `service_role` key. It bypasses row-level security, which is the only
     * way one dashboard can author a diet plan for somebody else's account — and
     * exactly why it must never be sent to a browser. Every use of it is a
     * server-to-server fetch from inside this Worker.
     */
    SUPABASE_SERVICE_KEY: string;
}

/**
 * A catalogue row, as the CMS edits it.
 *
 * The media columns (`cloudinary_*`, `secure_url`, the dimensions) are written
 * by the seeder, not by hand, so they are absent here. An exercise created in
 * the dashboard gets empty media and picks it up on the next
 * `bun run seed` — the app already treats a blank URL as "no animation" rather
 * than as an error.
 */
export interface ExerciseRow {
    id: string;
    name: string;
    category: string;
    gif_filename: string;
    equipment: string;
    primary_muscle_groups: string;
    secondary_muscle_groups: string;
    is_active: number;
    secure_url: string;
    updated_at: number;
}

export interface ExerciseInput {
    id: string;
    name: string;
    category: string;
    gifFilename: string;
    equipment: string[];
    primaryMuscleGroups: string[];
    secondaryMuscleGroups: string[];
    isActive: boolean;
}

/** Mirrors `meal` in the app's local SQLite; see supabase/migrations/0002. */
export interface MealRow {
    id: string;
    account_id: string;
    user_id: string;
    date: string;
    slot: MealSlot;
    plan_id: string | null;
    notes: string | null;
    created_at: number | null;
    updated_at: number | null;
}

/** Mirrors `meal_item`. `order` is reserved in Postgres, so it is `position`. */
export interface MealItemRow {
    id: string;
    account_id: string;
    meal_id: string;
    name: string;
    quantity: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    consumed_at: number | null;
    position: number;
    created_at: number | null;
    updated_at: number | null;
}

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const isMealSlot = (value: string): value is MealSlot =>
    (MEAL_SLOTS as readonly string[]).includes(value);

export const EXERCISE_CATEGORIES = [
    'strength',
    'cardio',
    'flexibility',
    'yoga',
    'pilates',
    'other',
] as const;
