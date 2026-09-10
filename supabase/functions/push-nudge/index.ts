import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { HTTPException } from 'hono/http-exception';

import { pickNudgeMessage } from '../_shared/nudge-copy.ts';
import { sendPushMessages, type PushMessage } from './expo-push.ts';
import { fetchDueRecipients } from './supabase.ts';
import { readEnv, type NudgeRunResult } from './types.ts';

/**
 * The daily motivational nudge, sent once per invocation.
 *
 * `/run` does the whole job in one call: read who is due (see
 * `due_push_recipients` in supabase/migrations/0006), pick each of them one
 * of the forty messages in `_shared/nudge-copy.ts`, send through Expo. Meant
 * to be triggered once a day by a `pg_cron` schedule calling this with
 * `net.http_post` — see the SQL comment at the bottom of 0006 for the exact
 * statement — or manually from a terminal while testing.
 *
 * Basic-auth gated like `syn-backfill`, for the same reason: this is
 * triggered by an operator or a cron job with a stored credential, never by
 * the app, so there is no Supabase JWT to check instead.
 */

const env = readEnv();

const ROUTE_BASE = '/push-nudge';

const app = new Hono().basePath(ROUTE_BASE);

app.use('*', basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD }));

/**
 * Spreads messages across recipients by hashing the account id rather than
 * by `Math.random()` — nothing about which message a given account sees
 * needs to be unpredictable, and a stable pick is easier to reason about
 * from a support conversation ("what did the notification actually say")
 * than one that would have been different had the same run happened a
 * second later.
 */
const hashSeed = (value: string): number => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }
    return hash;
};

app.post('/run', async (c) => {
    const recipients = await fetchDueRecipients(env);

    if (recipients.length === 0) {
        return c.json<NudgeRunResult>({ recipients: 0, sent: 0, ticketErrors: 0 });
    }

    // A day-of-year component in the seed, not just the account id, so the
    // same person does not see the identical message every single day they
    // are nudged — the whole point of having forty of them.
    const dayOfYear = Math.floor(
        (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86_400_000,
    );

    const messages: PushMessage[] = recipients.map((recipient) => {
        const message = pickNudgeMessage(hashSeed(recipient.account_id) + dayOfYear);
        const locale = recipient.locale === 'hi' ? 'hi' : 'en';
        const copy = message[locale];

        return {
            to: recipient.expo_push_token,
            title: copy.title,
            body: copy.body,
            // Lands on Home, the screen "begin workout" already lives on —
            // exactly where acting on the nudge should go, not into a
            // dead-end notification-settings screen.
            data: { url: 'fitup:///' },
        };
    });

    const { tickets, errors } = await sendPushMessages(env, messages);

    return c.json<NudgeRunResult>({
        recipients: recipients.length,
        sent: tickets.length,
        ticketErrors: errors,
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
