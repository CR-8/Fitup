-- Exercise catalogue, migrated off Cloudflare D1.
--
-- This is the write side of what `workers/exercise-media/schema.sql` described
-- on SQLite. The two tables mirror it column for column, with three changes
-- SQLite's type system forced and Postgres does not need:
--
--   * `equipment`, `primary_muscle_groups`, `secondary_muscle_groups` and
--     `exercise_instruction.steps` were JSON-encoded TEXT in D1. Here they are
--     real `text[]` columns -- filterable, indexable, and no JSON.parse on the
--     way out.
--   * `is_active` was SQLite's 0/1 INTEGER. Here it is `boolean`.
--   * `updated_at` was Unix seconds as INTEGER. Here it is `timestamptz`.
--
-- `id` is unchanged on purpose: it is both the primary key and the keyset
-- pagination cursor, and it is the same id already stored in every install's
-- local SQLite. Changing it would break every workout that references an
-- exercise by id.
--
-- This table is public reference data, not account data -- there is no
-- `account_id` and no per-row ownership, unlike every other table in this
-- schema. It is populated by the one-off migration in
-- scripts/migrate-catalogue-to-supabase.ts (reading the live D1 database) and
-- kept current afterwards by the Payload CMS, both writing with the
-- `service_role` key.

-- exercise --------------------------------------------------------------

create table if not exists public.exercise (
    id                       text primary key,
    gif_filename             text not null unique,
    -- The dataset's one English name. A locale-specific override lives in
    -- exercise_instruction.name; this is what a translation falls back onto
    -- and the only name an untranslated locale ever had.
    name                     text not null,
    category                 text not null,
    equipment                text[] not null default '{}',
    primary_muscle_groups    text[] not null default '{}',
    secondary_muscle_groups  text[] not null default '{}',
    cloudinary_public_id     text not null,
    -- Cloudinary's asset version, so an animation can be cache-busted without
    -- touching the delivery prefix every client is configured with.
    cloudinary_version       bigint not null,
    secure_url               text not null,
    -- The upstream licence caps media at 180x180. Stored so a client can
    -- reserve layout space before the image loads.
    width                    integer not null,
    height                   integer not null,
    bytes                    integer not null,
    -- Whether the CMS considers this exercise publishable. The public catalogue
    -- endpoint (workers/exercise-media) deliberately still serves every row
    -- regardless of this flag -- 1,324 of them are already seeded into every
    -- installed app's local SQLite, and silently withdrawing one would orphan
    -- any workout referencing it. Filtering the app's own view is a
    -- coordinated Worker + app + sync change, not a column default.
    is_active                boolean not null default true,
    updated_at               timestamptz not null default now()
);

comment on table public.exercise is
    'The exercise catalogue. Public reference data -- no account_id, no RLS write access; read by anon/authenticated, written only by service_role.';

-- exercise_instruction ----------------------------------------------------
-- Everything about an exercise that changes with the language. `name` is NULL
-- for English, which is the one name the `exercise` table above already
-- holds -- the read path COALESCEs onto it, so an untranslated locale reads
-- as English rather than as nothing. `steps` is never NULL; an untranslated
-- locale simply has no row at all, and the read path falls back to the
-- English row's steps in that case.

create table if not exists public.exercise_instruction (
    exercise_id  text not null references public.exercise (id) on delete cascade,
    locale       text not null,
    steps        text[] not null default '{}',
    name         text,
    primary key (exercise_id, locale)
);

comment on table public.exercise_instruction is
    'Per-locale name override and instruction steps. name is NULL for English (see exercise.name); steps falls back to the English row when a locale has none.';

-- Row-level security ------------------------------------------------------
--
-- Unlike every other table in this schema, there is no owner to check against
-- -- this is shared public data. RLS is still enabled, with a read-only policy
-- for anon and authenticated, because Supabase's own security advisor flags
-- any public-schema table PostgREST exposes with RLS off. `service_role`
-- bypasses RLS unconditionally regardless of what is declared here, which is
-- how the migration script and the CMS write to it; no write policy exists for
-- anon or authenticated because none should ever be able to write here.

alter table public.exercise enable row level security;
alter table public.exercise_instruction enable row level security;

drop policy if exists exercise_public_read on public.exercise;
create policy exercise_public_read
    on public.exercise
    for select
    to anon, authenticated
    using (true);

drop policy if exists exercise_instruction_public_read on public.exercise_instruction;
create policy exercise_instruction_public_read
    on public.exercise_instruction
    for select
    to anon, authenticated
    using (true);

-- fetch_exercise_page -------------------------------------------------------
--
-- The keyset-paginated, locale-coalesced read the app's catalogue sync needs,
-- expressed once here rather than reconstructed from PostgREST's embed syntax
-- on every call. It reproduces workers/exercise-media/src/db.ts's D1 query
-- exactly:
--
--   * `WHERE id > cursor`, never OFFSET -- the last page costs what the first
--     page costs.
--   * name is COALESCE(locale override, English base name).
--   * instructions prefer the requested locale's steps, falling back to the
--     English row's steps, falling back to an empty array if neither exists.
--   * `p_limit + 1` rows are meant to be requested by the caller (as the
--     Worker's clampLimit already does) so the extra row proves whether
--     another page exists -- this function does not add one itself, to match
--     the existing hasMore-in-the-caller logic byte for byte.
--
-- `security invoker` (the default) rather than `security definer`: this
-- function is granted to no one but called only by the Worker's service_role
-- key, which already has full table access and gains nothing from running as
-- the function owner. Definer rights would be a needless privilege escalation
-- for a function that anon/authenticated can never reach anyway.

create or replace function public.fetch_exercise_page(
    p_locale text,
    p_cursor text default null,
    p_limit integer default 50
)
returns table (
    id                       text,
    name                     text,
    name_en                  text,
    category                 text,
    equipment                text[],
    primary_muscle_groups    text[],
    secondary_muscle_groups  text[],
    gif_filename             text,
    secure_url               text,
    width                    integer,
    height                   integer,
    instructions             text[]
)
language sql
stable
as $$
    select
        e.id,
        coalesce(i.name, e.name) as name,
        e.name as name_en,
        e.category,
        e.equipment,
        e.primary_muscle_groups,
        e.secondary_muscle_groups,
        e.gif_filename,
        e.secure_url,
        e.width,
        e.height,
        case
            when i.steps is not null and array_length(i.steps, 1) > 0 then i.steps
            when f.steps is not null and array_length(f.steps, 1) > 0 then f.steps
            else '{}'::text[]
        end as instructions
    from public.exercise e
    left join public.exercise_instruction i
        on i.exercise_id = e.id and i.locale = p_locale
    left join public.exercise_instruction f
        on f.exercise_id = e.id and f.locale = 'en'
    where p_cursor is null or e.id > p_cursor
    order by e.id asc
    limit p_limit;
$$;

comment on function public.fetch_exercise_page is
    'Keyset-paginated catalogue read with locale fallback. Called by workers/exercise-media via PostgREST RPC, with service_role.';
