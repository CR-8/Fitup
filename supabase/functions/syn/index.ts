import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { embed } from '../_shared/embeddings.ts';
import { matchConditionGuidance, matchExercises } from './supabase.ts';
import { readEnv, type RetrieveRequest, type RetrieveResponse } from './types.ts';

/**
 * Syn's retrieval endpoint.
 *
 * One job: turn "what the user is asking for, plus what they have declared"
 * into "the catalogue rows and guidance passages that actually apply" — so the
 * app's prompt builder (src/ai/prompt.ts) can put real, ranked candidates in
 * front of the model instead of the first sixty rows a query happened to
 * return.
 *
 * Deliberately separate from `supabase/functions/cms`. That function is a
 * human at a dashboard, authenticated with a password the platform's own JWT
 * check has to be disabled for. This one is the app, calling in under its own
 * Supabase auth context — a session if signed in, the publishable key
 * otherwise — so it keeps the platform's default JWT verification rather than
 * substituting anything.
 *
 * Runs on Hono for the same reason the CMS does: the routing and error
 * handling below are not worth hand-rolling twice.
 */

const env = readEnv();

const ROUTE_BASE = '/syn';

const app = new Hono().basePath(ROUTE_BASE);

const DEFAULT_MATCH_COUNT = 60;
const MAX_MATCH_COUNT = 100;

app.post('/retrieve', async (c) => {
    let body: RetrieveRequest;

    try {
        body = (await c.req.json()) as RetrieveRequest;
    } catch {
        throw new HTTPException(400, { message: 'Body must be JSON' });
    }

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length === 0) {
        throw new HTTPException(400, { message: '"query" is required' });
    }

    const equipment = Array.isArray(body.equipment) ? body.equipment : [];
    const conditions = Array.isArray(body.conditions) ? body.conditions : [];
    const locale = typeof body.locale === 'string' && body.locale.length > 0 ? body.locale : 'en';
    const matchCount = Math.min(
        MAX_MATCH_COUNT,
        Math.max(1, Math.round(body.matchCount ?? DEFAULT_MATCH_COUNT)),
    );

    // Guidance is fetched before the vector search, not alongside it: its
    // `avoid` list is an input to the search, not a second thing rendered next
    // to it. A condition that has no authored row yet (see
    // supabase/migrations/0005's note on `body = ''`) simply contributes
    // nothing here, rather than failing the request.
    const guidance = await matchConditionGuidance(env, conditions, locale);
    const blockPatterns = guidance.flatMap((entry) => entry.avoid ?? []);

    const embedding = await embed(query);
    const candidates = await matchExercises(env, embedding, matchCount, equipment, blockPatterns);

    const response: RetrieveResponse = {
        candidates,
        guidance: guidance.map(({ condition, title, body: guidanceBody }) => ({
            condition,
            title,
            body: guidanceBody,
        })),
    };

    return c.json(response);
});

app.onError((error) => {
    if (error instanceof HTTPException) return error.getResponse();

    return new Response(
        JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
    );
});

/**
 * Same path-normalisation as the CMS, and the same reason: the platform
 * strips `/functions/v1` today, so `app.fetch` normally sees `/syn/retrieve`
 * directly and matches `ROUTE_BASE`. This defends the other case — the prefix
 * arriving unstripped, as `/functions/v1/syn/retrieve` — by trimming exactly
 * that prefix before routing, so the function works under either behaviour
 * rather than depending on one of them staying true.
 */
Deno.serve((request) => {
    const url = new URL(request.url);
    const fullPath = `/functions/v1${ROUTE_BASE}`;

    if (url.pathname.startsWith(fullPath)) {
        url.pathname = url.pathname.slice('/functions/v1'.length);
        return app.fetch(new Request(url, request));
    }

    return app.fetch(request);
});
