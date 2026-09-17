/**
 * Strapi's own database — its working copy of exercises and foods, plus its
 * admin users and permissions. Not the app's Supabase database: this is
 * editorial storage, synced out to `catalogue_exercises` / `catalogue_foods`
 * on publish by `src/lib/catalogue-sync.ts`, one direction only.
 *
 * Defaults to SQLite so `bun install && bun run dev` works with zero external
 * setup, matching how the mobile app itself defaults to local-only. Set
 * DATABASE_CLIENT=postgres for a deployed instance that should survive a
 * redeploy without a volume.
 */
export default ({ env }: { env: (key: string, fallback?: unknown) => any }) => {
    const client = env('DATABASE_CLIENT', 'sqlite');

    const connections: Record<string, unknown> = {
        sqlite: {
            connection: {
                filename: env('DATABASE_FILENAME', '.tmp/data.db'),
            },
            useNullAsDefault: true,
        },
        postgres: {
            connection: {
                connectionString: env('DATABASE_URL'),
                host: env('DATABASE_HOST', 'localhost'),
                port: env.int('DATABASE_PORT', 5432),
                database: env('DATABASE_NAME', 'strapi'),
                user: env('DATABASE_USERNAME', 'strapi'),
                password: env('DATABASE_PASSWORD'),
                ssl: env.bool('DATABASE_SSL', false) && {
                    rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
                },
            },
            pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
        },
    };

    return {
        connection: {
            client,
            ...(connections[client] as object),
            acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
        },
    };
};
