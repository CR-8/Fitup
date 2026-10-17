-- Awards: the catalogue the CMS publishes, and the awards each account earned.
--
-- `catalogue_awards` is written only by the Payload CMS (cms-payload, the
-- Awards collection) with the service role, and read by every app install,
-- signed in or not, the way `catalogue_exercises` is. The app ships the same
-- awards built in, so an empty or unreachable catalogue changes nothing; a row
-- here overrides the built-in award of the same id, and `is_active = false`
-- hides one.
--
-- `metric` names the figure the app measures (see AWARD_METRICS in
-- src/screens/awards/data.ts). `target` null means "the person's own goal for
-- that figure" (their calorie, water or weekly session goal). `name` and
-- `description` are keyed by locale, e.g. {"en": "...", "hi": "..."};
-- descriptions may use {{value}} and {{target}}.

create table if not exists public.catalogue_awards (
    id           text primary key,
    metric       text not null,
    target       integer,
    repeat       text not null default 'once' check (repeat in ('once', 'daily', 'weekly')),
    award_group  text not null default 'workouts' check (award_group in ('daily', 'workouts')),
    shape        text not null default 'circle' check (shape in ('circle', 'square', 'diamond')),
    symbol       text not null default 'trophy',
    color        text not null default '#D6F25A',
    name         jsonb not null default '{}'::jsonb,
    description  jsonb not null default '{}'::jsonb,
    sort_order   integer not null default 0,
    is_active    boolean not null default true,
    updated_at   timestamptz not null default now()
);

alter table public.catalogue_awards enable row level security;

drop policy if exists catalogue_awards_read on public.catalogue_awards;
create policy catalogue_awards_read
    on public.catalogue_awards
    for select
    to anon, authenticated
    using (true);

-- The awards an account earned, backed up like everything in 0001. Mirrors the
-- local `award_earned` table (src/db/schema/award.ts) through its entry in
-- src/services/backup/tables.ts. `id` is `<user id>_<award id>_<period>`, set
-- by the device, so the same award earned twice for one period is one row.

create table if not exists public.awards_earned (
    id           text primary key,
    account_id   uuid not null default auth.uid(),
    user_id      text not null,
    award_id     text not null,
    period       text not null,
    value        integer not null,
    created_at   bigint,
    updated_at   bigint,
    synced_at    timestamptz not null default now()
);

create index if not exists awards_earned_account_idx
    on public.awards_earned (account_id);

alter table public.awards_earned enable row level security;

drop policy if exists awards_earned_owner on public.awards_earned;
create policy awards_earned_owner
    on public.awards_earned
    for all
    to authenticated
    using (account_id = auth.uid())
    with check (account_id = auth.uid());
