/**
 * Syn's completion proxy.
 *
 * The app sends an OpenAI-compatible chat-completions request here instead of to
 * the provider, so the provider key lives in a function secret and never in the
 * binary. Per request this function:
 *
 *   1. verifies the caller's Supabase JWT (a signed-in person, not just the
 *      publishable key),
 *   2. counts the request against the monthly plan-build quota and a per-minute
 *      rate limit, atomically, in `ai_usage` (supabase/migrations/0011, 0012,
 *      0014). A plan build is charged once: its retries carry the same
 *      `X-Syn-Build` id and pass free (up to four requests a build),
 *   3. forwards the body to the provider with the key attached, and returns the
 *      provider's answer body untouched,
 *   4. gives a plan build back (`ai_refund`) when it failed before the person got
 *      anything: a non-2xx or error envelope, no content, a reply cut off at the
 *      token ceiling, a timeout, or the app hanging up.
 *
 * Every answer after the usage check carries `X-Syn-Builds-Remaining` (plan
 * builds left this month, after any refund) and `X-Syn-Builds-Reset` (the next
 * UTC month start, `YYYY-MM-DD`), which the app shows instead of its own count.
 *
 * Plain `Deno.serve`, no framework: it is one route.
 *
 * Secrets (set with `supabase secrets set`):
 *   AI_API_KEY               the provider credential. Required.
 *   AI_BASE_URL              e.g. https://openrouter.ai/api/v1. Required.
 *   AI_COMPLETIONS_PATH      default /chat/completions.
 *   AI_MONTHLY_PLAN_LIMIT    plan builds per user per UTC month. Default 3.
 *   AI_RATE_LIMIT_PER_MINUTE requests per user per minute. Default 10.
 *   AI_ALLOWED_MODELS        optional comma list; when set, any other `model` is
 *                            replaced with the first entry.
 * Platform-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */

const required = (name: string): string => {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`${name} is not set`);

    return value;
};

const numberFromEnv = (name: string, fallback: number): number => {
    const parsed = Number(Deno.env.get(name));

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SUPABASE_URL = required('SUPABASE_URL');
const SUPABASE_ANON_KEY = required('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');
const AI_API_KEY = required('AI_API_KEY');
const AI_BASE_URL = required('AI_BASE_URL').replace(/\/+$/, '');
const AI_PATH = Deno.env.get('AI_COMPLETIONS_PATH') ?? '/chat/completions';
const MONTHLY_PLAN_LIMIT = numberFromEnv('AI_MONTHLY_PLAN_LIMIT', 3);
const RATE_LIMIT = numberFromEnv('AI_RATE_LIMIT_PER_MINUTE', 10);
const ALLOWED_MODELS = (Deno.env.get('AI_ALLOWED_MODELS') ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

/** Ten minutes of headroom is plenty; a plan takes under one. */
const PROVIDER_TIMEOUT_MS = 120_000;
/** A chat or plan request is a few KB of text; this stops the function being used as a bulk relay. */
const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });

const failure = (status: number, type: string, message: string, headers = {}): Response =>
    json(status, { error: { type, message } }, headers);

/** The user behind a bearer token, or null. Uses the anon key: `getUser` verifies the JWT with Auth. */
const userIdFromToken = async (authorization: string | null): Promise<string | null> => {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!response.ok) return null;

    const user = (await response.json()) as { id?: string; is_anonymous?: boolean };

    return typeof user.id === 'string' ? user.id : null;
};

type Consumption = {
    allowed: boolean;
    reason?: 'monthly_quota' | 'rate_limit';
    retry_after?: number;
    /** The month's plan builds so far, this request included when it was counted. */
    plan_count: number;
    /** `YYYY-MM`, the UTC month it was counted in. */
    month: string;
};

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(args),
    });

    if (!response.ok) throw new Error(`${name} failed with ${response.status}`);

    return (await response.json()) as T;
};

// Throws when the quota cannot be checked, which the caller turns into a 503:
// fail closed, a quota that cannot be checked is not a free pass.
const consume = (userId: string, isPlan: boolean, build: string | null): Promise<Consumption> =>
    rpc<Consumption>('ai_consume', {
        p_user: userId,
        p_is_plan: isPlan,
        p_monthly_limit: MONTHLY_PLAN_LIMIT,
        p_rate_limit: RATE_LIMIT,
        p_window_seconds: 60,
        p_build: build,
    });

/** The app's id for one plan build, shared by its retries; anything odd counts as none. */
const buildIdFrom = (value: string | null): string | null =>
    value && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;

/** Builds left and the day they renew. Empty if `ai_consume` predates 0012 and sent no count. */
const usageHeaders = (planCount: number | undefined): Record<string, string> => {
    if (typeof planCount !== 'number') return {};

    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return {
        'X-Syn-Builds-Remaining': String(Math.max(0, MONTHLY_PLAN_LIMIT - planCount)),
        'X-Syn-Builds-Reset': reset.toISOString().slice(0, 10),
    };
};

/**
 * Whether a plan reply the provider answered 2xx is still one the app cannot
 * use: a gateway's error envelope, no content, or cut off at the token ceiling.
 * A body this cannot read counts as delivered, so asking for a format it does
 * not parse (a stream, say) never earns a refund.
 */
const isFailedPlan = (text: string): boolean => {
    try {
        const reply = JSON.parse(text) as {
            error?: unknown;
            choices?: { message?: { content?: unknown }; finish_reason?: string }[];
        };
        const choice = reply.choices?.[0];
        const content = choice?.message?.content;

        return (
            reply.error != null ||
            typeof content !== 'string' ||
            content.trim() === '' ||
            choice?.finish_reason === 'length'
        );
    } catch {
        return false;
    }
};

Deno.serve(async (request) => {
    if (request.method !== 'POST') return failure(405, 'method', 'POST only');

    const userId = await userIdFromToken(request.headers.get('Authorization'));
    if (!userId) return failure(401, 'auth', 'Sign in to use Syn');

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return failure(413, 'too_large', 'Request too large');

    let body: Record<string, unknown>;
    try {
        body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return failure(400, 'bad_request', 'Body must be JSON');
    }
    if (!Array.isArray(body.messages)) return failure(400, 'bad_request', '"messages" is required');

    // A plan build is the request that asks for a JSON object; chat replies are prose.
    const isPlan =
        typeof body.response_format === 'object' &&
        body.response_format !== null &&
        (body.response_format as { type?: string }).type === 'json_object';

    let consumption: Consumption;
    try {
        consumption = await consume(userId, isPlan, buildIdFrom(request.headers.get('X-Syn-Build')));
    } catch (error) {
        console.error(error);

        return failure(503, 'unavailable', 'Could not check your usage. Try again.');
    }

    if (!consumption.allowed) {
        const usage = usageHeaders(consumption.plan_count);

        if (consumption.reason === 'rate_limit') {
            return failure(429, 'rate_limit', 'Too many requests', {
                'Retry-After': String(consumption.retry_after ?? 60),
                ...usage,
            });
        }

        return failure(
            403,
            'monthly_quota',
            'You have used all your plan builds this month.',
            usage,
        );
    }

    if (ALLOWED_MODELS.length > 0 && !ALLOWED_MODELS.includes(String(body.model))) {
        body.model = ALLOWED_MODELS[0];
    }
    // The device never chooses who is billed or where the request goes.
    delete body.user;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    let planCount = consumption.plan_count;

    // Best effort: a refund that fails is logged, not turned into a second error
    // on a reply that is already failing.
    const refund = async () => {
        if (!isPlan) return;

        try {
            planCount =
                (await rpc<number | null>('ai_refund', {
                    p_user: userId,
                    p_month: consumption.month,
                })) ?? planCount;
        } catch (error) {
            console.error(error);
        }
    };

    try {
        const upstream = await fetch(
            `${AI_BASE_URL}${AI_PATH.startsWith('/') ? AI_PATH : `/${AI_PATH}`}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${AI_API_KEY}`,
                },
                body: JSON.stringify(body),
                // The app hanging up (cancelled, or its own shorter timeout) aborts the
                // provider call too, which lands in the refund below.
                signal: AbortSignal.any([controller.signal, request.signal]),
            },
        );
        const contentType = upstream.headers.get('Content-Type') ?? 'application/json';

        // Chat never spends a build, so it is passed through as it arrives.
        if (!isPlan) {
            return new Response(upstream.body, {
                status: upstream.status,
                headers: { 'Content-Type': contentType, ...usageHeaders(planCount) },
            });
        }

        // A plan is read whole first, so a failed one is refunded before the
        // answer leaves and its headers already count the refund.
        const text = await upstream.text();
        if (!upstream.ok || isFailedPlan(text)) await refund();

        return new Response(text, {
            status: upstream.status,
            headers: { 'Content-Type': contentType, ...usageHeaders(planCount) },
        });
    } catch (error) {
        console.error(error);
        await refund();

        return failure(
            504,
            'upstream',
            'The AI provider did not answer in time.',
            usageHeaders(planCount),
        );
    } finally {
        clearTimeout(timeout);
    }
});
