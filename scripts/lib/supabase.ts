/**
 * Supabase writes for the seeding and migration scripts, over PostgREST.
 *
 * Plain `fetch` rather than `@supabase/supabase-js`, for the same reason
 * `workers/cms` does it this way: the client would be a dependency wrapping the
 * three requests below, and these scripts run under `tsx` where a smaller
 * surface is worth more than the ergonomics.
 *
 * Authenticated with the project's secret key, which bypasses row-level
 * security. That is the whole point -- `supabase/migrations/0003` grants the
 * catalogue tables a read policy and no write policy at all, so the seeder and
 * the CMS are the only things that can write them. It follows that the key is a
 * secret: it lives in `.env.local`, never takes an `EXPO_PUBLIC_` prefix, and
 * never reaches a client.
 *
 * Unlike D1, there is no 100-bound-parameter ceiling here. An upsert is one
 * JSON array, so the batching that used to be dictated by column count is now
 * only about keeping a single request a sensible size.
 */

/** Rows per request. The whole catalogue is ~1.5 MB, so this is generous. */
export const UPSERT_CHUNK = 500;

export class SupabaseNotConfiguredError extends Error {
    constructor(missing: string[]) {
        super(
            `Missing ${missing.join(', ')}. Copy .env.example to .env.local and fill them in.\n` +
                'Project URL: Supabase > Project Settings > Data API.\n' +
                'Secret key:  Supabase > Project Settings > API Keys. Use the secret key\n' +
                '             (sb_secret_...), not the publishable one -- writing the\n' +
                '             catalogue needs to bypass row-level security.\n' +
                'It is a secret. Never give it an EXPO_PUBLIC_ prefix, or it compiles\n' +
                'into the app binary where anyone with the APK can read it.',
        );
        this.name = 'SupabaseNotConfiguredError';
    }
}

export interface SupabaseClient {
    /** Inserts or updates `rows`, conflicting on `onConflict`. */
    upsert: (table: string, rows: Record<string, unknown>[], onConflict: string) => Promise<number>;
    /** Exact row count, read from the `content-range` header. */
    count: (table: string) => Promise<number>;
    /**
     * Deletes every row `filter` matches, and returns how many went.
     *
     * `filter` is a PostgREST query string and is required, not optional:
     * PostgREST refuses an unqualified delete, and having to write the predicate
     * is the point — `account_id=not.is.null` says "all of them" on a column
     * declared `not null`, and says it without a list of ids that could miss a
     * row nobody remembered.
     */
    deleteAll: (table: string, filter: string) => Promise<number>;
    /** Arbitrary read returning rows, for the verification steps. */
    select: <T>(path: string) => Promise<T[]>;
    /**
     * A read whose body is a single value rather than a row set — which is what
     * a function returning `jsonb`, such as `catalogue_page`, answers with.
     */
    selectOne: <T>(path: string) => Promise<T | null>;
}

export const connectSupabase = (): SupabaseClient => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
    // Supabase renamed these keys; accept both spellings so a project on either
    // scheme works without anyone having to know which one they are on.
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();

    const missing = [
        !url && 'EXPO_PUBLIC_SUPABASE_URL',
        !key && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter((value): value is string => typeof value === 'string');

    if (missing.length > 0) throw new SupabaseNotConfiguredError(missing);

    const headers = {
        apikey: key as string,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
    };

    const fail = async (response: Response, what: string): Promise<never> => {
        const detail = await response.text();
        throw new Error(`Supabase ${what} failed: ${response.status} ${detail.slice(0, 400)}`);
    };

    const client: SupabaseClient = {
        upsert: async (table, rows, onConflict) => {
            if (rows.length === 0) return 0;

            for (let offset = 0; offset < rows.length; offset += UPSERT_CHUNK) {
                const batch = rows.slice(offset, offset + UPSERT_CHUNK);

                const response = await fetch(
                    `${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
                    {
                        method: 'POST',
                        headers: {
                            ...headers,
                            // `merge-duplicates` is PostgREST's ON CONFLICT DO
                            // UPDATE. Without it a re-run is a primary key
                            // violation rather than an update.
                            prefer: 'resolution=merge-duplicates,return=minimal',
                        },
                        body: JSON.stringify(batch),
                    },
                );

                if (!response.ok) await fail(response, `upsert into ${table}`);
            }

            return rows.length;
        },

        count: async (table) => {
            const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
                headers: { ...headers, prefer: 'count=exact' },
            });

            if (!response.ok) await fail(response, `count of ${table}`);

            // PostgREST reports the total after the slash: `0-0/1324`.
            const range = response.headers.get('content-range') ?? '';
            const total = Number(range.split('/')[1]);

            return Number.isFinite(total) ? total : 0;
        },

        deleteAll: async (table, filter) => {
            const before = await client.count(table);

            const response = await fetch(`${url}/rest/v1/${table}?${filter}`, {
                method: 'DELETE',
                // `return=minimal` because the rows are on their way out and the
                // caller already has them: every destructive path here dumps
                // first, so echoing them back is a second copy of a file on disk.
                headers: { ...headers, prefer: 'return=minimal' },
            });

            if (!response.ok) await fail(response, `delete from ${table}`);

            return before - (await client.count(table));
        },

        select: async <T>(path: string) => {
            const response = await fetch(`${url}/rest/v1/${path}`, { headers });

            if (!response.ok) await fail(response, `select ${path}`);

            return (await response.json()) as T[];
        },

        selectOne: async <T>(path: string) => {
            const response = await fetch(`${url}/rest/v1/${path}`, { headers });

            if (!response.ok) await fail(response, `select ${path}`);

            return ((await response.json()) ?? null) as T | null;
        },
    };

    return client;
};
