/**
 * The CMS's environment.
 *
 * This used to carry a `DB` binding to Cloudflare D1 alongside the Supabase
 * credentials, because the catalogue and the diet plans lived in different
 * databases. They are both in Postgres now, so there is one credential and one
 * client, and the split disappears.
 *
 * Read from `Deno.env` at startup rather than handed in per request: Edge
 * Functions have no per-request bindings the way Workers do. `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform, so only the two
 * dashboard credentials have to be set with `supabase secrets set`.
 */
export interface Env {
    ADMIN_USER: string;
    ADMIN_PASSWORD: string;
    SUPABASE_URL: string;
    /**
     * The service-role key. It bypasses row-level security, which is the only
     * way one dashboard can write the catalogue at all — `0003` grants those
     * tables a read policy and no write policy — and the only way it can author
     * a diet plan for somebody else's account. Exactly why it must never be
     * sent to a browser. Every use of it is a server-to-server fetch from
     * inside this function.
     */
    SUPABASE_SERVICE_KEY: string;
}

const required = (name: string, value: string | undefined): string => {
    if (!value) {
        throw new Error(
            `${name} is not set. Platform values are injected automatically; the two ` +
                'dashboard credentials come from `supabase secrets set ADMIN_USER=… ' +
                'ADMIN_PASSWORD=…`.',
        );
    }

    return value;
};

export const readEnv = (): Env => ({
    ADMIN_USER: required('ADMIN_USER', Deno.env.get('ADMIN_USER')),
    ADMIN_PASSWORD: required('ADMIN_PASSWORD', Deno.env.get('ADMIN_PASSWORD')),
    SUPABASE_URL: required('SUPABASE_URL', Deno.env.get('SUPABASE_URL')),
    SUPABASE_SERVICE_KEY: required(
        'SUPABASE_SERVICE_ROLE_KEY',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY'),
    ),
});

/**
 * A catalogue row, as the CMS edits it.
 *
 * The media columns (`cloudinary_*`, the dimensions, `bytes`) are written by the
 * seeder, not by hand, so they are absent here. An exercise created in the
 * dashboard gets empty media and picks it up on the next `bun run seed` — the
 * app already treats a blank URL as "no animation" rather than as an error.
 *
 * The three list columns are real arrays now. On D1 they were TEXT holding
 * JSON, and every reader had to parse them first.
 */
export interface ExerciseRow {
    id: string;
    name: string;
    category: string;
    gif_filename: string;
    equipment: string[];
    primary_muscle_groups: string[];
    secondary_muscle_groups: string[];
    /** A real boolean now; D1 stored 0 or 1. */
    is_active: boolean;
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
