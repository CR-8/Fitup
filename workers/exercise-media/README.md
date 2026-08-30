# fitup-exercise-media

Serves the Fitup exercise catalogue from Cloudflare D1.

## Setup

```bash
cd workers/exercise-media
bun install

# 1. Create the database, then paste the printed database_id into wrangler.jsonc
npx wrangler d1 create fitup-exercises

# 2. Apply the schema and seed, from the repository root.
#    Needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and
#    CLOUDFLARE_D1_DATABASE_ID in .env.local — no browser login required.
cd ../.. && bun run db:push && bun run seed

# 3. Run locally, then deploy
cd workers/exercise-media
npx wrangler dev
npx wrangler deploy
```

## Endpoints

| Route | Purpose |
|---|---|
| `GET /v1/exercises?cursor=&limit=&locale=` | One page of the catalogue |
| `GET /health` | Row count; never cached |

`limit` is clamped to 1..100 (default 50). `locale` is one of `en es hi ru zh`;
anything else is a 400. Untranslated exercises fall back to English rather than
returning empty instructions, and an exercise with no instructions in any locale
is still returned.

Pagination is keyset (`WHERE id > ?`), not `OFFSET` — the last page costs the
same as the first.

## Behaviour worth knowing

- **Rate limit runs before the cache.** Cache-first would let a hot page be
  requested without limit. 60 requests per 60s per client IP.
- **Cache TTL is 5 minutes**, keyed on the full URL, written under
  `ctx.waitUntil` so the write survives the response returning.
- **Errors are never cached** (`no-store`), so a transient database failure is
  not served for the following five minutes.
- **No `nodejs_compat`.** D1 is reached through a binding, so there is no driver
  reaching for Node built-ins and nothing to pool.

## Seeding limits

D1 caps a query at **100 bound parameters**, which fixes the seeder's batch
sizes: 7 rows per `exercise` statement (14 columns) and 33 per
`exercise_instruction` (3 columns). Raising them fails at runtime, mid-seed.

## Licensing

Exercise data is MIT (exercises-dataset). The animations are © Gym visual and
are **not** covered by that licence — see `docs/exercise-attribution.md` in the
repository root before deploying this anywhere public.
