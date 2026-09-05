import type { Env, MealItemRow, MealRow, MealSlot } from './types';

/**
 * Diet plans, on Supabase.
 *
 * PostgREST is plain HTTP, so this is `fetch` rather than `@supabase/supabase-js`
 * — the client would add a few hundred kilobytes to a Worker bundle to wrap the
 * same six requests, and a Worker pays for that on every cold start.
 *
 * Authenticated with the `service_role` key, which bypasses row-level security.
 * That is deliberate and is the only way one dashboard can author a plan for
 * another person's account, but it means every call here is trusted: there is no
 * database-side check left to catch a mistake, so `accountId` is always passed
 * explicitly rather than inferred.
 */

const ID_ALPHABET = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict';

/** A 21-character id, matching the nanoid the app gives its own rows. */
export const newId = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(21));
    let id = '';
    for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
    return id;
};

const request = async <T>(
    env: Env,
    path: string,
    init: RequestInit & { returning?: boolean } = {},
): Promise<T> => {
    const { returning = true, ...rest } = init;

    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
        ...rest,
        headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'content-type': 'application/json',
            // Without this PostgREST answers a write with 204 and no body.
            prefer: returning ? 'return=representation' : 'return=minimal',
            ...(rest.headers as Record<string, string> | undefined),
        },
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase ${response.status}: ${detail.slice(0, 400)}`);
    }

    if (!returning || response.status === 204) return undefined as T;

    return (await response.json()) as T;
};

export interface Profile {
    account_id: string;
    local_user_id: string;
    display_name: string | null;
}

export const listProfiles = (env: Env): Promise<Profile[]> =>
    request<Profile[]>(
        env,
        'profiles?select=account_id,local_user_id,display_name&order=display_name.nullsfirst',
    );

export interface MealWithItems extends MealRow {
    meal_items: MealItemRow[];
}

/**
 * Meals for one account, newest day first, with their items embedded.
 *
 * The embed is PostgREST's own join, so a plan of thirty meals is one request
 * rather than thirty-one.
 */
export const listMeals = (env: Env, accountId: string): Promise<MealWithItems[]> =>
    request<MealWithItems[]>(
        env,
        `meals?select=*,meal_items(*)&account_id=eq.${encodeURIComponent(accountId)}` +
            '&order=date.desc,slot.asc',
    );

export const getMeal = async (env: Env, id: string): Promise<MealWithItems | null> => {
    const rows = await request<MealWithItems[]>(
        env,
        `meals?select=*,meal_items(*)&id=eq.${encodeURIComponent(id)}&limit=1`,
    );

    return rows[0] ?? null;
};

export interface MealInput {
    accountId: string;
    userId: string;
    date: string;
    slot: MealSlot;
    planId: string | null;
    notes: string | null;
}

export const createMeal = async (env: Env, input: MealInput): Promise<string> => {
    const now = Date.now();
    const id = newId();

    await request<MealRow[]>(env, 'meals', {
        method: 'POST',
        body: JSON.stringify({
            id,
            account_id: input.accountId,
            user_id: input.userId,
            date: input.date,
            slot: input.slot,
            plan_id: input.planId,
            notes: input.notes,
            created_at: now,
            updated_at: now,
        }),
    });

    return id;
};

export const updateMeal = (env: Env, id: string, input: Omit<MealInput, 'accountId'>) =>
    request<MealRow[]>(env, `meals?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
            user_id: input.userId,
            date: input.date,
            slot: input.slot,
            plan_id: input.planId,
            notes: input.notes,
            updated_at: Date.now(),
        }),
    });

/** Items go first: nothing else deletes them, and PostgREST issues no cascade. */
export const deleteMeal = async (env: Env, id: string): Promise<void> => {
    const scoped = encodeURIComponent(id);
    await request(env, `meal_items?meal_id=eq.${scoped}`, {
        method: 'DELETE',
        returning: false,
    });
    await request(env, `meals?id=eq.${scoped}`, { method: 'DELETE', returning: false });
};

export interface MealItemInput {
    accountId: string;
    mealId: string;
    name: string;
    quantity: string | null;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    position: number;
}

export const createMealItem = async (env: Env, input: MealItemInput): Promise<void> => {
    const now = Date.now();

    await request<MealItemRow[]>(env, 'meal_items', {
        method: 'POST',
        body: JSON.stringify({
            id: newId(),
            account_id: input.accountId,
            meal_id: input.mealId,
            name: input.name,
            quantity: input.quantity,
            calories: input.calories,
            protein_g: input.proteinG,
            carbs_g: input.carbsG,
            fat_g: input.fatG,
            position: input.position,
            created_at: now,
            updated_at: now,
        }),
    });
};

export const deleteMealItem = (env: Env, id: string) =>
    request(env, `meal_items?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        returning: false,
    });

/** Totals for a meal, so the dashboard can show what a plan actually adds up to. */
export const macroTotals = (items: MealItemRow[]) =>
    items.reduce(
        (total, item) => ({
            calories: total.calories + (item.calories ?? 0),
            proteinG: total.proteinG + (item.protein_g ?? 0),
            carbsG: total.carbsG + (item.carbs_g ?? 0),
            fatG: total.fatG + (item.fat_g ?? 0),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
