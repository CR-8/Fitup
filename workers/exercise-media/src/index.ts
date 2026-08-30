import { clampLimit, fetchPage, ping } from './db';
import { DEFAULT_LOCALE, isLocale, type Env } from './types';

/**
 * Serves the Fitup exercise catalogue.
 *
 * Deliberately unauthenticated. The app's promise is that training works with no
 * account, and since the catalogue no longer ships inside the binary, a
 * signed-out install has to be able to fetch it. Everything here is public,
 * read-only reference data.
 *
 * Routing is a plain switch rather than a framework: three routes do not repay
 * a dependency, and a Worker pays for every kilobyte of bundle on cold start.
 *
 * Media is © Gym visual; see docs/exercise-attribution.md.
 */

/** How long a page stays fresh, at the edge and in any client cache. */
const CACHE_TTL_SECONDS = 300;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            // The app is not a browser origin, but a dashboard or a curl from a
            // web page should be able to read this too.
            'access-control-allow-origin': '*',
            ...headers,
        },
    });

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method !== 'GET') {
            return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
        }

        // 1. Rate limit, before anything else.
        //
        // Keyed on the client IP rather than the path: keying on the path would
        // let one abusive caller exhaust the budget for a page and lock every
        // other client out of it. Checking the cache first would be worse still
        // — a cached page would be free to hammer without limit.
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const { success } = await env.API_RATE_LIMITER.limit({ key: ip });

        if (!success) {
            return json({ error: 'rate_limited' }, 429, { 'retry-after': '60' });
        }

        if (url.pathname === '/health') {
            // Never cached: a health check answered from cache tells you nothing
            // about whether the database is currently reachable.
            try {
                return json({ ok: true, exercises: await ping(env) }, 200, {
                    'cache-control': 'no-store',
                });
            } catch (error) {
                return json(
                    { ok: false, error: error instanceof Error ? error.message : String(error) },
                    503,
                    { 'cache-control': 'no-store' },
                );
            }
        }

        if (url.pathname !== '/v1/exercises') {
            return json({ error: 'not_found' }, 404);
        }

        // 2. Cache. Keyed on the full URL, so each cursor/limit/locale
        //    combination is stored separately.
        const cache = caches.default;
        const cached = await cache.match(request);
        if (cached) return cached;

        // 3. Database.
        const rawLocale = url.searchParams.get('locale') ?? DEFAULT_LOCALE;
        // Validated against a fixed list before it reaches SQL. It is a bound
        // parameter either way, but an unknown locale should be a clear 400
        // rather than a silently empty page.
        if (!isLocale(rawLocale)) {
            return json({ error: 'invalid_locale', locale: rawLocale }, 400);
        }

        try {
            const page = await fetchPage(env, {
                cursor: url.searchParams.get('cursor'),
                limit: clampLimit(url.searchParams.get('limit')),
                locale: rawLocale,
            });

            const response = json(page, 200, {
                'cache-control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
            });

            // Without waitUntil the Worker can be torn down the moment the
            // response is returned, cancelling the cache write — every request
            // would stay a miss and the TTL would never do anything.
            ctx.waitUntil(cache.put(request, response.clone()));

            return response;
        } catch (error) {
            // Not cached: a transient database failure must not be served for
            // the next five minutes.
            return json(
                { error: 'upstream_error', message: error instanceof Error ? error.message : String(error) },
                502,
                { 'cache-control': 'no-store' },
            );
        }
    },
} satisfies ExportedHandler<Env>;
