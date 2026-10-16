/**
 * Deletes the calling person's account and everything backed up for it.
 *
 * App Store (5.1.1(v)) and Google Play both require an in-app way to delete an
 * account. The app calls this with the signed-in user's JWT; the function acts on
 * exactly that user and no other, and cannot be pointed at someone else's id.
 *
 * In order:
 *   1. verify the JWT and resolve the user id,
 *   2. delete the account's rows from every backup table, children first (the
 *      tables carry `account_id`, not a foreign key to auth.users, so nothing
 *      cascades),
 *   3. remove their feedback screenshots from storage,
 *   4. delete the auth user, which cascades `feedback` and `ai_usage`.
 *
 * Idempotent: a retry after a partial failure finds fewer rows and finishes the
 * job. The auth user goes last on purpose; deleting it first would leave rows
 * nobody can authenticate to remove.
 *
 * Plain `Deno.serve`. Platform-provided: SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY (never sent to the app).
 */

const required = (name: string): string => {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`${name} is not set`);

    return value;
};

const SUPABASE_URL = required('SUPABASE_URL');
const SUPABASE_ANON_KEY = required('SUPABASE_ANON_KEY');
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

/** Children before parents. Keep in step with src/services/backup/tables.ts and the push/diet/favourites migrations. */
const OWNED_TABLES = [
    'exercise_sets',
    'workout_exercises',
    'workout_groups',
    'workouts',
    'meal_items',
    'meals',
    'exercise_favorites',
    'push_tokens',
    'measurements',
    'custom_exercises',
    'training_profiles',
    'profiles',
] as const;

const FEEDBACK_BUCKET = 'feedback-screenshots';

const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const service = (path: string, init: RequestInit = {}): Promise<Response> =>
    fetch(`${SUPABASE_URL}${path}`, {
        ...init,
        headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });

const userIdFromToken = async (authorization: string | null): Promise<string | null> => {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!response.ok) return null;

    const user = (await response.json()) as { id?: string };

    return typeof user.id === 'string' ? user.id : null;
};

const deleteScreenshots = async (userId: string): Promise<void> => {
    const listing = await service(`/storage/v1/object/list/${FEEDBACK_BUCKET}`, {
        method: 'POST',
        body: JSON.stringify({ prefix: userId, limit: 1000 }),
    });
    if (!listing.ok) return;

    const objects = (await listing.json()) as { name: string }[];
    if (objects.length === 0) return;

    const removal = await service(`/storage/v1/object/${FEEDBACK_BUCKET}`, {
        method: 'DELETE',
        body: JSON.stringify({ prefixes: objects.map((object) => `${userId}/${object.name}`) }),
    });
    if (!removal.ok) throw new Error(`Removing screenshots failed with ${removal.status}`);
};

Deno.serve(async (request) => {
    if (request.method !== 'POST') return json(405, { error: 'POST only' });

    const userId = await userIdFromToken(request.headers.get('Authorization'));
    if (!userId) return json(401, { error: 'Sign in again to delete your account.' });

    try {
        for (const table of OWNED_TABLES) {
            const response = await service(
                `/rest/v1/${table}?account_id=eq.${encodeURIComponent(userId)}`,
                { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
            );
            // A table that does not exist on this project is not a reason to stop.
            if (!response.ok && response.status !== 404) {
                throw new Error(`Deleting from ${table} failed with ${response.status}`);
            }
        }

        await deleteScreenshots(userId);

        const removal = await service(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE',
        });
        if (!removal.ok) throw new Error(`Deleting the auth user failed with ${removal.status}`);

        return json(200, { deleted: true });
    } catch (error) {
        console.error(error);

        return json(500, { error: 'Could not finish deleting your account. Try again.' });
    }
});
