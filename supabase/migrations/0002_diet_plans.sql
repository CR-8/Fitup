-- Diet plans, authored in the CMS.
--
-- These two tables mirror `meal` and `meal_item` in the app's local SQLite
-- (src/db/schema/nutrition.ts) column for column, so the same rows can travel
-- in either direction: the CMS writes a plan here for the app to pull, and the
-- app's own nutrition logging can later back up into the same shape without a
-- second schema to reconcile. Nutrition is not in `BACKUP_TABLES` yet -- adding
-- it is a separate change in src/services/backup/tables.ts, and this migration
-- deliberately does not assume it.
--
-- The conventions from 0001 are kept exactly:
--
--   * Every `*_at` column is `bigint` holding Unix milliseconds, as SQLite
--     stores it, so timestamps round-trip byte for byte.
--   * Rows keep a 21-character nanoid primary key, so writes are idempotent and
--     local foreign keys survive a restore.
--   * `order` is reserved in Postgres, so the ordering column is `position`.
--     src/services/backup/tables.ts owns that rename for every other table.

-- meals ---------------------------------------------------------------------
-- `date` is a local calendar day as `YYYY-MM-DD`, not a timestamp. A meal
-- belongs to the day the person ate it, and an instant would move that day when
-- they travel. `plan_id` is the plan a meal came from when it was not entered
-- by hand -- which, for everything the CMS writes, is always.

create table if not exists public.meals (
    id          text primary key,
    account_id  uuid not null default auth.uid(),
    user_id     text not null,
    date        text not null,
    slot        text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
    plan_id     text,
    notes       text,
    created_at  bigint,
    updated_at  bigint,
    synced_at   timestamptz not null default now()
);

-- meal_items ----------------------------------------------------------------
-- Macros live on the item rather than joining a food catalogue, because there
-- is no such catalogue: entries come from a plan or from someone typing them.
-- Keeping them here means an item is meaningful on its own, and a later
-- catalogue can be added without rewriting history.
--
-- `consumed_at` is set by the app when the person confirms they ate it. The CMS
-- authors plans and never sets it: what was eaten is not the planner's to say.

create table if not exists public.meal_items (
    id           text primary key,
    account_id   uuid not null default auth.uid(),
    meal_id      text not null references public.meals (id) on delete cascade,
    name         text not null,
    quantity     text,
    calories     double precision,
    protein_g    double precision,
    carbs_g      double precision,
    fat_g        double precision,
    consumed_at  bigint,
    position     integer not null default 0,
    created_at   bigint,
    updated_at   bigint,
    synced_at    timestamptz not null default now()
);

create index if not exists meals_account_idx       on public.meals (account_id);
create index if not exists meals_account_date_idx  on public.meals (account_id, date);
create index if not exists meals_plan_idx          on public.meals (plan_id);
create index if not exists meal_items_account_idx  on public.meal_items (account_id);
create index if not exists meal_items_meal_idx     on public.meal_items (meal_id, position);

-- Row-level security --------------------------------------------------------
--
-- Same model as 0001: a signed-in client reaches PostgREST with its own access
-- token and can only ever see and write its own rows. `with check` matters as
-- much as `using`, or a client could insert a row stamped with somebody else's
-- account_id.
--
-- The CMS is the deliberate exception. It authenticates with the `service_role`
-- key, which bypasses RLS entirely -- that is the only way one dashboard can
-- author a plan for another person's account. It follows that the key is a
-- Cloudflare Worker secret and must never reach a browser; workers/cms uses it
-- only in server-to-server fetches.

do $$
declare
    t text;
begin
    foreach t in array array['meals', 'meal_items']
    loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists %I on public.%I', t || '_owner', t);
        execute format(
            'create policy %I on public.%I for all to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid())',
            t || '_owner',
            t
        );
    end loop;
end
$$;
