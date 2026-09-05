# FitSync CMS

An admin dashboard on Cloudflare Workers, over the two databases the product
actually stores content in:

- **Exercises** — the catalogue on Cloudflare D1, the same `fitup-exercises`
  database `workers/exercise-media` serves read-only. This is its write side.
- **Diet plans** — `meals` and `meal_items` on Supabase, mirroring the app's
  local nutrition tables column for column.

Server-rendered HTML, plain forms, no client framework and no build step:
`wrangler deploy` is the whole pipeline.

## Why not SonicJS

SonicJS was the starting point, and the stack here is its stack — Hono, D1,
Wrangler on Cloudflare Workers. The package itself was dropped for one reason:
its collections are *"TypeScript config objects registered at app startup — no
database table required"*, i.e. it generates and owns its own content tables.
Both entities here are external to that. The exercise catalogue is a
pre-existing D1 table with a fixed shape that another Worker already serves to
every installed app, and Supabase is a database SonicJS has no concept of. Its
collection layer and its bundled `better-auth` would have been carried and then
bypassed for both.

## Running it

```sh
bun install
bun run dev        # wrangler dev, against the real D1 binding
bun run typecheck
bun run deploy
```

## Configuration

The D1 binding is in `wrangler.jsonc` and is deliberately the same
`database_id` as `workers/exercise-media` — two databases would drift the moment
either side wrote.

Everything else is a secret, set with `wrangler secret put <NAME>`:

| Secret | What it is |
| --- | --- |
| `ADMIN_USER` | Dashboard login |
| `ADMIN_PASSWORD` | Dashboard login |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | The `service_role` key |

`SUPABASE_SERVICE_KEY` bypasses row-level security. That is the only way one
dashboard can author a plan for somebody else's account, and it is exactly why
the key must never reach a browser — it is read inside the Worker and used only
in server-to-server fetches to PostgREST. Every route is behind HTTP basic auth;
there is no anonymous surface, because this Worker writes production data and
read-only access to it is not a use case.

## Schema changes this depends on

Both are additive and safe to apply to a live system.

**D1 — `exercise.is_active`.** Carried in
`workers/exercise-media/schema.sql` for databases created from scratch, and
applied to an existing one with:

```sh
bun run d1:add-is-active     # from the repo root
```

`NOT NULL DEFAULT 1`, so every existing row reads as active and no row is
rewritten.

The catalogue endpoint in `workers/exercise-media/src/db.ts` still serves
**every** row, active or not. Deactivating an exercise hides it here and nowhere
else. That is on purpose: 1,324 catalogue rows are already seeded into every
install's SQLite, and silently withdrawing one would orphan any workout that
references it. Filtering the app's view is a coordinated Worker + app + sync
change, not a column default.

**Supabase — `meals` and `meal_items`.**
`supabase/migrations/0002_diet_plans.sql`, applied by hand in the Supabase SQL
editor like `0001`. They mirror `meal` and `meal_item` in
`src/db/schema/nutrition.ts`, keeping the 0001 conventions: `bigint` Unix-ms
timestamps, 21-character nanoid primary keys, and `order` renamed to `position`
because `order` is reserved in Postgres.

Note that nutrition is **not** in `BACKUP_TABLES` yet, so the app does not sync
these tables today. Plans authored here are stored correctly and are ready for
the app to pull; wiring that up is a separate change in
`src/services/backup/tables.ts`.

## Keeping it out of the app

The CMS must never be compiled into the React Native bundle. Three things ensure
that, and they should stay in step:

- `tsconfig.json` at the repo root already excludes `workers`.
- `metro.config.js` adds `workers/` to the resolver `blockList`.
- `.easignore` excludes `workers/` from the EAS build upload. Note that EAS uses
  `.easignore` *instead of* `.gitignore`, so that file repeats the git rules —
  dropping a line there starts uploading the files rather than falling back.
