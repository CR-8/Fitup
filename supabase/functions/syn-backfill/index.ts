import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { HTTPException } from 'hono/http-exception';

import { buildExercisePassage, buildFoodPassage, embed } from '../_shared/embeddings.ts';
import {
    listEnglishInstructions,
    listExercisePage,
    listFoodPage,
    upsertEmbeddings,
    upsertFoodEmbeddings,
} from './supabase.ts';
import { readEnv, type BackfillProgress } from './types.ts';

/**
 * Embeds the catalogue, one page at a time — or one row at a time, targeted.
 *
 * Two callers, two modes:
 *
 *   * A human, running a full or partial re-backfill from a terminal after a
 *     bulk catalogue change. Paged rather than one request that walks the
 *     whole thing: Edge Functions have an execution time ceiling, and ~1,300
 *     sequential embedding calls does not reliably fit under it. Call
 *     `POST /syn-backfill/run` (or `/run-foods`) with the `nextCursor` each
 *     response returns until `done` is `true`.
 *
 *   * The CMS's publish hook, passing `?ids=id1,id2`, right after it writes
 *     those rows to `catalogue_exercises` / `catalogue_foods`. `cursor` is
 *     ignored in this mode, and the response is always `done: true` — there
 *     is nothing to page through when the caller already knows exactly which
 *     rows changed.
 */

const env = readEnv();

const ROUTE_BASE = '/syn-backfill';

const app = new Hono().basePath(ROUTE_BASE);

/** Same basic-auth gate as the CMS: this writes production data. */
app.use('*', basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD }));

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

/**
 * `ids`, comma-separated: embed exactly those rows and ignore `cursor`.
 * This is the path the CMS's publish hook uses — it just wrote one row and
 * wants it embedded now, not queued behind a walk of the whole catalogue.
 */
const parseIds = (c: { req: { query: (name: string) => string | undefined } }): string[] | undefined => {
    const raw = c.req.query('ids');
    if (!raw) return undefined;
    return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
};

app.post('/run', async (c) => {
    const cursor = c.req.query('cursor') ?? null;
    const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number(c.req.query('limit')) || DEFAULT_PAGE_SIZE),
    );
    const ids = parseIds(c);

    const exercises = await listExercisePage(env, cursor, limit, ids);

    if (exercises.length === 0) {
        return c.json<BackfillProgress>({ processed: 0, nextCursor: null, done: true });
    }

    const instructions = await listEnglishInstructions(
        env,
        exercises.map((exercise) => exercise.id),
    );
    const stepsById = new Map(instructions.map((row) => [row.exercise_id, row.steps]));

    // Sequential, not Promise.all: `Supabase.ai.Session.run` shares one model
    // instance per cold start (see _shared/embeddings.ts), and there is
    // nothing to gain from racing requests against a resource that is not
    // actually parallel — only more concurrent memory pressure on the
    // function's own instance.
    const rows: { exercise_id: string; content: string; embedding: number[] }[] = [];
    for (const exercise of exercises) {
        const content = buildExercisePassage({
            name: exercise.name,
            category: exercise.category,
            primaryMuscleGroups: exercise.primary_muscle_groups,
            secondaryMuscleGroups: exercise.secondary_muscle_groups,
            equipment: exercise.equipment,
            instructions: stepsById.get(exercise.id) ?? [],
        });

        const embedding = await embed(content);
        rows.push({ exercise_id: exercise.id, content, embedding });
    }

    await upsertEmbeddings(env, rows);

    // Targeted mode has no pages to walk: it is always the last (and only) one.
    const lastId = exercises[exercises.length - 1]?.id ?? null;

    return c.json<BackfillProgress>({
        processed: rows.length,
        nextCursor: ids || exercises.length < limit ? null : lastId,
        done: Boolean(ids) || exercises.length < limit,
    });
});

app.post('/run-foods', async (c) => {
    const cursor = c.req.query('cursor') ?? null;
    const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number(c.req.query('limit')) || DEFAULT_PAGE_SIZE),
    );
    const ids = parseIds(c);

    const foods = await listFoodPage(env, cursor, limit, ids);

    if (foods.length === 0) {
        return c.json<BackfillProgress>({ processed: 0, nextCursor: null, done: true });
    }

    const rows: { food_id: string; content: string; embedding: number[] }[] = [];
    for (const food of foods) {
        const content = buildFoodPassage({
            name: food.name,
            category: food.category,
            servingSize: food.serving_size,
            caloriesKcal: food.calories,
            proteinG: food.protein_g,
            carbsG: food.carbs_g,
            fatG: food.fat_g,
        });

        const embedding = await embed(content);
        rows.push({ food_id: food.id, content, embedding });
    }

    await upsertFoodEmbeddings(env, rows);

    const lastId = foods[foods.length - 1]?.id ?? null;

    return c.json<BackfillProgress>({
        processed: rows.length,
        nextCursor: ids || foods.length < limit ? null : lastId,
        done: Boolean(ids) || foods.length < limit,
    });
});

app.onError((error) => {
    if (error instanceof HTTPException) return error.getResponse();

    return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        { status: 500, headers: { 'content-type': 'application/json' } },
    );
});

Deno.serve((request) => {
    const url = new URL(request.url);
    const fullPath = `/functions/v1${ROUTE_BASE}`;

    if (url.pathname.startsWith(fullPath)) {
        url.pathname = url.pathname.slice('/functions/v1'.length);
        return app.fetch(new Request(url, request));
    }

    return app.fetch(request);
});
