import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { HTTPException } from 'hono/http-exception';

import {
    countByStatus,
    createExercise,
    deleteExercise,
    getExercise,
    listCategories,
    listExercises,
    setExerciseActive,
    toList,
    updateExercise,
    type StatusFilter,
} from './exercises.ts';
import {
    createMeal,
    createMealItem,
    deleteMeal,
    deleteMealItem,
    getMeal,
    listMeals,
    listProfiles,
} from './supabase.ts';
import { isMealSlot, readEnv } from './types.ts';
import { LINK_BASE, ROUTE_BASE, errorBanner, html, layout } from './ui.ts';
import { dietPage, exerciseFormPage, exerciseListPage } from './views.ts';

/**
 * The Fitup CMS.
 *
 * One Supabase Edge Function over one database: the exercise catalogue and the
 * diet plans are both in Postgres now. It used to be a Cloudflare Worker
 * straddling two — the catalogue on D1 through a binding, the diet plans on
 * Supabase through PostgREST — which is the split this move exists to close.
 *
 * Hono still, and unchanged: it runs on Deno natively, so the routing, the auth
 * middleware and the whole HTML layer came across as they were.
 *
 * Deliberately not SonicJS or a hosted admin: its collections are its own
 * generated tables, and both entities here are pre-existing tables with fixed
 * shapes that the app and the seeder also write.
 */

// Read once, at startup. Edge Functions have no per-request bindings the way
// Workers do, so there is no `c.env` and nothing to thread through the handlers.
const env = readEnv();

/**
 * Routed under the function's own name, not its full public path.
 *
 * Supabase publishes this at `/functions/v1/cms/...` but strips `/functions/v1`
 * on the way in, so what arrives here starts `/cms/...`. Using the public path
 * as the base path is a 404 on every route, including the auth middleware —
 * which then never runs, so the dashboard answers unauthenticated requests with
 * a "not found" instead of a password prompt.
 *
 * Links and redirects are the other direction and use `LINK_BASE`; see `ui.ts`.
 */
const app = new Hono().basePath(ROUTE_BASE);

/**
 * Everything behind one login.
 *
 * Basic auth rather than a session: the browser owns the credential prompt, so
 * there is no login page, no cookie, and no session store to get wrong. Hono
 * compares in constant time. There is no anonymous surface at all — this
 * function writes production data, and read-only access to it is not a use
 * case.
 *
 * This is also why the function must be deployed with `--no-verify-jwt`. Edge
 * Functions check for a Supabase JWT before the handler runs, and a browser
 * sending an `Authorization: Basic` header has none — every request would be
 * rejected before Hono ever saw it. See `supabase/config.toml`.
 */
app.use('*', basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD }));

app.get('/', (c) => c.redirect(`${LINK_BASE}/exercises`));

const asStatus = (value: string | undefined): StatusFilter =>
    value === 'active' || value === 'inactive' ? value : 'all';

/** Reports the failure rather than a blank page — the operator needs the reason. */
const message = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

// ---------------------------------------------------------------- exercises

app.get('/exercises', async (c) => {
    const search = c.req.query('search') ?? '';
    const category = c.req.query('category') ?? '';
    const status = asStatus(c.req.query('status'));
    const cursor = c.req.query('cursor') ?? null;

    const [page, categories, counts] = await Promise.all([
        listExercises(env, { search, category, status, cursor }),
        listCategories(env),
        countByStatus(env),
    ]);

    return html(
        layout(
            'Exercises',
            'exercises',
            exerciseListPage({
                items: page.items,
                nextCursor: page.nextCursor,
                categories,
                counts,
                search,
                category,
                status,
                error: null,
            }),
        ),
    );
});

app.get('/exercises/new', async (c) =>
    html(
        layout('New exercise', 'exercises', exerciseFormPage(null, await listCategories(env), null)),
    ),
);

const readExerciseForm = async (c: {
    req: { parseBody: () => Promise<Record<string, unknown>> };
}) => {
    const body = await c.req.parseBody();
    const text = (key: string): string => String(body[key] ?? '').trim();

    return {
        id: text('id'),
        name: text('name'),
        category: text('category'),
        gifFilename: text('gifFilename'),
        equipment: toList(text('equipment')),
        primaryMuscleGroups: toList(text('primaryMuscleGroups')),
        secondaryMuscleGroups: toList(text('secondaryMuscleGroups')),
        isActive: text('isActive') !== '0',
    };
};

app.post('/exercises/new', async (c) => {
    const input = await readExerciseForm(c);

    if (!input.id || !input.name || !input.gifFilename) {
        return html(
            layout(
                'New exercise',
                'exercises',
                exerciseFormPage(
                    null,
                    await listCategories(env),
                    'Id, name and gif filename are required.',
                ),
            ),
            400,
        );
    }

    try {
        await createExercise(env, input);
    } catch (error) {
        // `id` and `gif_filename` are both unique, so a clash is the likely
        // cause and the operator can fix it from the message.
        return html(
            layout(
                'New exercise',
                'exercises',
                exerciseFormPage(null, await listCategories(env), message(error)),
            ),
            400,
        );
    }

    return c.redirect(`${LINK_BASE}/exercises`);
});

app.get('/exercises/:id', async (c) => {
    const exercise = await getExercise(env, c.req.param('id'));
    if (!exercise) return html(layout('Not found', 'exercises', '<h1>No such exercise.</h1>'), 404);

    return html(
        layout(
            'Edit exercise',
            'exercises',
            exerciseFormPage(exercise, await listCategories(env), null),
        ),
    );
});

app.post('/exercises/:id', async (c) => {
    const id = c.req.param('id');
    const input = { ...(await readExerciseForm(c)), id };

    if (!input.name || !input.gifFilename) {
        const exercise = await getExercise(env, id);
        return html(
            layout(
                'Edit exercise',
                'exercises',
                exerciseFormPage(
                    exercise,
                    await listCategories(env),
                    'Name and gif filename are required.',
                ),
            ),
            400,
        );
    }

    await updateExercise(env, input);

    return c.redirect(`${LINK_BASE}/exercises`);
});

app.post('/exercises/:id/toggle', async (c) => {
    const id = c.req.param('id');
    const exercise = await getExercise(env, id);
    if (!exercise) return c.redirect(`${LINK_BASE}/exercises`);

    await setExerciseActive(env, id, !exercise.is_active);

    return c.redirect(`${LINK_BASE}/exercises`);
});

app.post('/exercises/:id/delete', async (c) => {
    await deleteExercise(env, c.req.param('id'));

    return c.redirect(`${LINK_BASE}/exercises`);
});

// --------------------------------------------------------------------- diet

app.get('/diet', async (c) => {
    const accountId = c.req.query('accountId') ?? '';

    try {
        const profiles = await listProfiles(env);
        const meals = accountId ? await listMeals(env, accountId) : [];

        return html(
            layout('Diet plans', 'diet', dietPage({ profiles, accountId, meals, error: null })),
        );
    } catch (error) {
        return html(
            layout(
                'Diet plans',
                'diet',
                dietPage({ profiles: [], accountId, meals: [], error: message(error) }),
            ),
            502,
        );
    }
});

/** Back to the account that was on screen, so the operator keeps their place. */
const backToDiet = (accountId: string) =>
    `${LINK_BASE}/diet?accountId=${encodeURIComponent(accountId)}`;

app.post('/diet/meals', async (c) => {
    const body = await c.req.parseBody();
    const text = (key: string): string => String(body[key] ?? '').trim();

    const accountId = text('accountId');
    const slot = text('slot');

    if (!accountId || !text('userId') || !text('date') || !isMealSlot(slot)) {
        return c.redirect(backToDiet(accountId));
    }

    await createMeal(env, {
        accountId,
        userId: text('userId'),
        date: text('date'),
        slot,
        planId: text('planId') || null,
        notes: text('notes') || null,
    });

    return c.redirect(backToDiet(accountId));
});

app.post('/diet/meals/:id/delete', async (c) => {
    const body = await c.req.parseBody();
    const accountId = String(body.accountId ?? '');

    await deleteMeal(env, c.req.param('id'));

    return c.redirect(backToDiet(accountId));
});

app.post('/diet/meals/:id/items', async (c) => {
    const mealId = c.req.param('id');
    const body = await c.req.parseBody();
    const text = (key: string): string => String(body[key] ?? '').trim();

    /** Blank stays null rather than becoming 0 — an unknown macro is not zero. */
    const num = (key: string): number | null => {
        const raw = text(key);
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const accountId = text('accountId');
    if (!accountId || !text('name')) return c.redirect(backToDiet(accountId));

    // Appended, so a new item lands after whatever is already there. One meal,
    // not the account's whole plan, to work out a single integer.
    const existing = (await getMeal(env, mealId))?.meal_items ?? [];
    const position = existing.reduce((max, item) => Math.max(max, item.position + 1), 0);

    await createMealItem(env, {
        accountId,
        mealId,
        name: text('name'),
        quantity: text('quantity') || null,
        calories: num('calories'),
        proteinG: num('proteinG'),
        carbsG: num('carbsG'),
        fatG: num('fatG'),
        position,
    });

    return c.redirect(backToDiet(accountId));
});

app.post('/diet/items/:id/delete', async (c) => {
    const body = await c.req.parseBody();
    const accountId = String(body.accountId ?? '');

    await deleteMealItem(env, c.req.param('id'));

    return c.redirect(backToDiet(accountId));
});

// ------------------------------------------------------------------ fallback

app.notFound(() => html(layout('Not found', 'exercises', '<h1>Not found.</h1>'), 404));

app.onError((error) => {
    /**
     * A failed login is an `HTTPException`, and it carries its own response: a
     * 401 with the `WWW-Authenticate` header. That header is the entire login
     * mechanism — without it the browser never shows a password box — so it has
     * to pass through rather than being folded into the 500 below.
     */
    if (error instanceof HTTPException) return error.getResponse();

    return html(
        layout(
            'Error',
            'exercises',
            // A root-relative link, like every other one in the HTML. `layout`
            // adds the function's base path; writing it in here as well would
            // produce it twice.
            `<h1>Something failed.</h1>${errorBanner(message(error))}` +
                '<p><a href="/exercises">Back</a></p>',
        ),
        500,
    );
});

/**
 * Normalises the incoming path before routing.
 *
 * The platform strips `/functions/v1` today, and the routes above are declared
 * to match that. This trims it if it ever arrives anyway, so the function works
 * under either behaviour rather than depending on one of them staying true.
 */
Deno.serve((request) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith(LINK_BASE)) {
        url.pathname = url.pathname.slice('/functions/v1'.length);
        return app.fetch(new Request(url, request));
    }

    return app.fetch(request);
});
