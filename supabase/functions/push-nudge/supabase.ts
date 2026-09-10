import type { Env, PushRecipient } from './types.ts';

/**
 * The one read this function does: who is due a nudge today.
 *
 * `due_push_recipients` (supabase/migrations/0006) does the actual
 * eligibility filtering in SQL — no workout completed since local midnight —
 * so this is a single RPC call rather than a query this function would
 * otherwise have to build and keep in step with the table.
 */
export const fetchDueRecipients = async (env: Env): Promise<PushRecipient[]> => {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/due_push_recipients`, {
        method: 'POST',
        headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase rpc/due_push_recipients ${response.status}: ${detail.slice(0, 400)}`);
    }

    return (await response.json()) as PushRecipient[];
};
