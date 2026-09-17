# FitSyn CMS (Strapi)

The admin dashboard for the exercise and food catalogues. Replaces the two
earlier CMS attempts (`workers/cms` on Cloudflare, `supabase/functions/cms` on
Supabase Edge Functions) with one editorial tool that has drafts, revisions,
media, and a real admin UI instead of hand-rolled HTML forms.

## What it owns, and what it doesn't

Strapi's own database (`config/database.ts`, SQLite by default) holds the
**editorial** copy of exercises and foods — drafts, unpublished edits,
revision history. It is not what the app or the AI planner reads.

`catalogue_exercises` and `catalogue_foods` in Supabase are what they read.
Publishing an entry here (`src/api/*/content-types/*/lifecycles.ts`,
`afterPublish`) upserts it there over PostgREST, then calls the already
-deployed `syn-backfill` Edge Function with `?ids=<the-one-id>` to refresh
just that row's embedding — synchronous, targeted, no waiting on a full
backfill. Unpublishing sets `is_active = false` there rather than deleting,
same as the retired CMS did: the catalogue is seeded into every install's
local database, and silently removing a row would orphan a workout or a meal
referencing it.

One direction, one writer per row. Nothing reads the Supabase tables back
into Strapi.

## Never in the app bundle

Three independent guarantees, and they should stay in step:

- Root `tsconfig.json` excludes `cms`.
- Root `metro.config.js` blocks `[\\/]cms[\\/].*` from the resolver.
- Root `.easignore` excludes `cms/` from the EAS build upload.

`cms` has its own `package.json`, its own `node_modules`, and is never
imported from `src/` — nothing here should ever need a fourth guarantee, but
if one of the three above is ever removed, this stops being true silently.

## Running it

```sh
cd cms
cp .env.example .env   # fill in the secrets it lists
npm install
npm run dev            # strapi develop, admin UI at http://localhost:1337/admin
```

First run creates the admin user through the UI. After that, `npm run dev`
again just starts it.

## Food catalogue

New in this cutover — there was no food catalogue before, only freeform
`meal_item` text (`src/db/schema/nutrition.ts`, untouched by this). Manual
meal logging keeps working exactly as it does today; the `food` content type
here and `catalogue_foods` / `food_embeddings` in Supabase
(`supabase/migrations/0008_food_catalogue.sql`) are additive, for the AI diet
planner to draw suggestions from via `match_foods`, the same way
`supabase/functions/syn` already calls `match_exercises`.
