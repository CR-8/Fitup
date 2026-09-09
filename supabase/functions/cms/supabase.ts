import type { Env, MealItemRow, MealRow, MealSlot } from './types.ts';

/**
 * Every database call the CMS makes, over PostgREST.
 *
 * Plain `fetch` rather than `@supabase/supabase-js`: the client would wrap the
 * same dozen requests and a function pays for its bundle on every cold start.
 *
 * Authenticated with the `service_role` key, which bypasses row-level security.
 * That is deliberate and load-bearing twice over — it is the only way one
 * dashboard can author a plan for another person's account, and the only way
 * anything can write the catalogue, whose tables have a read policy and no
 * write policy. It follows that every call here is trusted: there is no
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

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    /** Sent as JSON. Pass the object; this stringifies it. */
    body?: unknown;
    /** False for writes whose result nobody reads, which saves a round trip's payload. */
    returning?: boolean;
    /** Ask for the exact row count instead of the rows, read from `content-range`. */
    count?: boolean;
    /** PostgREST's `on_conflict` target, for an upsert. */
    onConflict?: string;
}

export const request = async <T>(env: Env, path: string, options: RequestOptions = {}): Promise<T> => {
    const { method = 'GET', body, returning = true, count = false, onConflict } = options;

    const prefer = [
        // Without this PostgREST answers a write with 204 and no body.
        returning && !count ? 'return=representation' : 'return=minimal',
        count ? 'count=exact' : null,
        onConflict ? 'resolution=merge-duplicates' : null,
    ]
        .filter((value): value is string => value !== null)
        .join(',');

    const url = onConflict
        ? `${env.SUPABASE_URL}/rest/v1/${path}${path.includes('?') ? '&' : '?'}on_conflict=${onConflict}`
        : `${env.SUPABASE_URL}/rest/v1/${path}`;

    const response = await fetch(url, {
        method,
        headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'content-type': 'application/json',
            prefer,
            // A count request wants the header, not the rows.
            ...(count ? { range: '0-0' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase ${response.status}: ${detail.slice(0, 400)}`);
    }

    if (count) {
        // PostgREST reports the total after the slash: `0-0/1324`.
        const total = Number((response.headers.get('content-range') ?? '').split('/')[1]);
        return (Number.isFinite(total) ? total : 0) as T;
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
        returning: false,
        body: {
            id,
            account_id: input.accountId,
            user_id: input.userId,
            date: input.date,
            slot: input.slot,
            plan_id: input.planId,
            notes: input.notes,
            created_at: now,
            updated_at: now,
        },
    });

    return id;
};

export const updateMeal = (env: Env, id: string, input: Omit<MealInput, 'accountId'>) =>
    request<MealRow[]>(env, `meals?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        returning: false,
        body: {
            user_id: input.userId,
            date: input.date,
            slot: input.slot,
            plan_id: input.planId,
            notes: input.notes,
            updated_at: Date.now(),
        },
    });

/**
 * Deletes a meal.
 *
 * `meal_items.meal_id` is declared `on delete cascade` in
 * `supabase/migrations/0002`, so the items go with it. This used to delete them
 * first by hand because the CMS's other database, D1, had no foreign keys — the
 * habit is not needed here.
 */
export const deleteMeal = async (env: Env, id: string): Promise<void> => {
    await request(env, `meals?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        returning: false,
    });
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
        returning: false,
        body: {
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
        },
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
