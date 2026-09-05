import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';

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
} from './exercises';
import {
    createMeal,
    createMealItem,
    deleteMeal,
    deleteMealItem,
    getMeal,
    listMeals,
    listProfiles,
} from './supabase';
import { isMealSlot, type Env } from './types';
import { errorBanner, html, layout } from './ui';
import { dietPage, exerciseFormPage, exerciseListPage } from './views';

/**
 * The FitSync CMS.
 *
 * One Cloudflare Worker over two databases: the exercise catalogue on D1 (the
 * same database `workers/exercise-media` serves read-only) and diet plans on
 * Supabase. Hono because this has a couple of dozen routes and a body parser —
 * the sibling Worker routes with a switch precisely because three routes did not
 * repay a dependency, and this is the other side of that judgement.
 *
 * Deliberately not SonicJS: its collections are its own generated tables, and
 * both entities here are external — a pre-existing D1 table with a fixed shape
 * that another Worker serves, and a Postgres database it has no concept of. Its
 * content layer would have been carried and then bypassed for both.
 */

const app = new Hono<{ Bindings: Env }>();

/**
 * Everything behind one login.
 *
 * Basic auth rather than a session: the browser owns the credential prompt, so
 * there is no login page, no cookie, and no session store to get wrong. Hono
 * compares in constant time. There is no anonymous surface at all — this Worker
 * writes production data, and read-only access to it is not a use case.
 */
app.use('*', async (c, next) =>
    basicAuth({ username: c.env.ADMIN_USER, password: c.env.ADMIN_PASSWORD })(c, next),
);

app.get('/', (c) => c.redirect('/exercises'));

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
        listExercises(c.env, { search, category, status, cursor }),
        listCategories(c.env),
        countByStatus(c.env),
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
    html(layout('New exercise', 'exercises', exerciseFormPage(null, await listCategories(c.env), null))),
);

const readExerciseForm = async (c: { req: { parseBody: () => Promise<Record<string, unknown>> } }) => {
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
                exerciseFormPage(null, await listCategories(c.env), 'Id, name and gif filename are required.'),
            ),
            400,
        );
    }

    try {
        await createExercise(c.env, input);
    } catch (error) {
        // `id` and `gif_filename` are both unique, so a clash is the likely
        // cause and the operator can fix it from the message.
        return html(
            layout(
                'New exercise',
                'exercises',
                exerciseFormPage(null, await listCategories(c.env), message(error)),
            ),
            400,
        );
    }

    return c.redirect('/exercises');
});

app.get('/exercises/:id', async (c) => {
    const exercise = await getExercise(c.env, c.req.param('id'));
    if (!exercise) return html(layout('Not found', 'exercises', '<h1>No such exercise.</h1>'), 404);

    return html(
        layout('Edit exercise', 'exercises', exerciseFormPage(exercise, await listCategories(c.env), null)),
    );
});

app.post('/exercises/:id', async (c) => {
    const id = c.req.param('id');
    const input = { ...(await readExerciseForm(c)), id };

    if (!input.name || !input.gifFilename) {
        const exercise = await getExercise(c.env, id);
        return html(
            layout(
                'Edit exercise',
                'exercises',
                exerciseFormPage(exercise, await listCategories(c.env), 'Name and gif filename are required.'),
            ),
            400,
        );
    }

    await updateExercise(c.env, input);

    return c.redirect('/exercises');
});

app.post('/exercises/:id/toggle', async (c) => {
    const id = c.req.param('id');
    const exercise = await getExercise(c.env, id);
    if (!exercise) return c.redirect('/exercises');

    await setExerciseActive(c.env, id, !exercise.is_active);

    return c.redirect('/exercises');
});

app.post('/exercises/:id/delete', async (c) => {
    await deleteExercise(c.env, c.req.param('id'));

    return c.redirect('/exercises');
});

// --------------------------------------------------------------------- diet

app.get('/diet', async (c) => {
    const accountId = c.req.query('accountId') ?? '';

    try {
        const profiles = await listProfiles(c.env);
        const meals = accountId ? await listMeals(c.env, accountId) : [];

        return html(layout('Diet plans', 'diet', dietPage({ profiles, accountId, meals, error: null })));
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
const backToDiet = (accountId: string) => `/diet?accountId=${encodeURIComponent(accountId)}`;

app.post('/diet/meals', async (c) => {
    const body = await c.req.parseBody();
    const text = (key: string): string => String(body[key] ?? '').trim();

    const accountId = text('accountId');
    const slot = text('slot');

    if (!accountId || !text('userId') || !text('date') || !isMealSlot(slot)) {
        return c.redirect(backToDiet(accountId));
    }

    await createMeal(c.env, {
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

    await deleteMeal(c.env, c.req.param('id'));

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
    const existing = (await getMeal(c.env, mealId))?.meal_items ?? [];
    const position = existing.reduce((max, item) => Math.max(max, item.position + 1), 0);

    await createMealItem(c.env, {
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

    await deleteMealItem(c.env, c.req.param('id'));

    return c.redirect(backToDiet(accountId));
});

// ------------------------------------------------------------------ fallback

app.notFound((c) => html(layout('Not found', 'exercises', '<h1>Not found.</h1>'), 404));

app.onError((error, c) =>
    html(
        layout(
            'Error',
            'exercises',
            `<h1>Something failed.</h1>${errorBanner(message(error))}<p><a href="/exercises">Back</a></p>`,
        ),
        500,
    ),
);

export default app;
