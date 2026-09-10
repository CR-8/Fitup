import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { HTTPException } from 'hono/http-exception';

import { buildExercisePassage, embed } from '../_shared/embeddings.ts';
import { listEnglishInstructions, listExercisePage, upsertEmbeddings } from './supabase.ts';
import { readEnv, type BackfillProgress } from './types.ts';

/**
 * Embeds the catalogue, one page at a time.
 *
 * A one-off maintenance job, run by a human from a terminal after the
 * catalogue changes materially — a full backfill, or a re-run after the CMS
 * edits a batch of exercises. It is not wired to run automatically on every
 * CMS write: `supabase/functions/cms` and this function both exist and both
 * work today, and connecting them is a small, separate change once the
 * cadence of catalogue edits after launch makes clear whether "automatic" or
 * "reviewed before it costs an embedding call" is the one actually wanted.
 *
 * Paged rather than one request that walks the whole catalogue: Edge
 * Functions have an execution time ceiling, and ~1,300 sequential embedding
 * calls does not reliably fit under it. Call `POST /syn-backfill/run` with the
 * `nextCursor` each response returns until `done` is `true` — the same
 * "call again with the cursor you were handed" shape the app's own catalogue
 * sync already uses.
 */

const env = readEnv();

const ROUTE_BASE = '/syn-backfill';

const app = new Hono().basePath(ROUTE_BASE);

/** Same basic-auth gate as the CMS: this writes production data. */
app.use('*', basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD }));

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

app.post('/run', async (c) => {
    const cursor = c.req.query('cursor') ?? null;
    const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number(c.req.query('limit')) || DEFAULT_PAGE_SIZE),
    );

    const exercises = await listExercisePage(env, cursor, limit);

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

    const lastId = exercises[exercises.length - 1]?.id ?? null;

    return c.json<BackfillProgress>({
        processed: rows.length,
        nextCursor: exercises.length < limit ? null : lastId,
        done: exercises.length < limit,
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
