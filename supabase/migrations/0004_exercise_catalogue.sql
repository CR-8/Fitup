-- The maintained exercise catalogue, moved here from Cloudflare D1.
--
-- 1,324 exercises and their per-locale instructions. This is the last thing the
-- product kept on a second platform: it lived on D1 and was served by a Worker
-- at `EXPO_PUBLIC_EXERCISE_API_URL`. Both are retired by this migration, so
-- Supabase now holds every row the app persists off-device.
--
-- Three things distinguish these tables from every other one in this schema,
-- and each is deliberate:
--
--   * They are NOT scoped by `account_id`. This is reference data, identical
--     for everyone. There is no owner column and nothing to scope by.
--
--   * They are readable by `anon`. The app's promise is that training works
--     without an account, and since the catalogue is fetched rather than
--     bundled, a signed-out install has to be able to read it. See the policies
--     at the bottom -- `using (true)` is what makes that true, and getting it
--     wrong fails silently.
--
--   * Nobody but the secret key can write them. There is no insert, update or
--     delete policy at all, so RLS refuses every write that is not from the
--     seeder or the CMS.
--
-- The conventions from 0001 and 0002 are kept: `*_at` is `bigint` holding Unix
-- milliseconds. D1 stored `updated_at` in *seconds*, so the migration script
-- multiplies by 1000 on the way in.

-- catalogue_exercises -------------------------------------------------------
-- Named for what it is, and to sit unambiguously beside `custom_exercises` in
-- 0001 -- which holds *user-authored* exercises for backup and is a different
-- thing entirely. One is reference data nobody owns; the other is somebody's
-- own work.
--
-- D1 is SQLite, so its JSON columns were TEXT and the Worker parsed them on
-- every read. Here they are `jsonb` and the parsing disappears.
--
-- The `cloudinary_*` columns and the dimensions stay exactly as they were.
-- Media is on Cloudinary, which is a different vendor from Cloudflare and is
-- not moving; these columns travel across as ordinary data.

create table if not exists public.catalogue_exercises (
    id                       text primary key,
    gif_filename             text not null unique,
    -- Always English. The dataset ships one name, and a translated name lives
    -- in catalogue_instructions.name for the locale that has one.
    name                     text not null,
    category                 text not null,
    equipment                jsonb not null default '[]'::jsonb
        check (jsonb_typeof(equipment) = 'array'),
    primary_muscle_groups    jsonb not null default '[]'::jsonb
        check (jsonb_typeof(primary_muscle_groups) = 'array'),
    secondary_muscle_groups  jsonb not null default '[]'::jsonb
        check (jsonb_typeof(secondary_muscle_groups) = 'array'),
    -- Written by the seeder from Cloudinary's response, never by hand. An
    -- exercise created in the CMS starts with these blank and picks them up on
    -- the next seed; the app already renders a blank url as "no animation"
    -- rather than as an error.
    cloudinary_public_id     text not null default '',
    -- Cloudinary's asset version, so one animation can be cache-busted without
    -- touching the delivery prefix every client is configured with.
    cloudinary_version       bigint not null default 0,
    secure_url               text not null default '',
    -- The upstream licence caps media at 180x180. Stored so a client can
    -- reserve layout space before the image loads.
    width                    integer not null default 0,
    height                   integer not null default 0,
    bytes                    integer not null default 0,
    -- Whether the CMS considers this exercise publishable. Written by the CMS
    -- and read only there: `catalogue_page` below deliberately still returns
    -- every row, because 1,324 of them are already seeded into every install's
    -- SQLite and silently withdrawing one would orphan any workout referencing
    -- it. Filtering the app's view is a coordinated schema + app change, not a
    -- column default.
    is_active                boolean not null default true,
    updated_at               bigint not null
);

-- catalogue_instructions ----------------------------------------------------
-- Everything about an exercise that changes with the language.
--
-- `name` is null for English, which is the one name `catalogue_exercises`
-- already holds; `catalogue_page` coalesces onto it, so an untranslated locale
-- reads as English rather than as nothing. At the time of writing every one of
-- the 1,324 Hindi rows carries a name and every English row does not, which is
-- exactly the shape this is built for.
--
-- The cascade replaces a two-statement batch the CMS used to run by hand,
-- because D1 had no foreign keys.

create table if not exists public.catalogue_instructions (
    exercise_id  text not null
        references public.catalogue_exercises (id) on delete cascade,
    locale       text not null,
    steps        jsonb not null default '[]'::jsonb
        check (jsonb_typeof(steps) = 'array'),
    name         text,
    primary key (exercise_id, locale)
);

-- The primary key on `id` already serves the keyset pagination in
-- `catalogue_page`. These two cover the CMS's category filter and the locale
-- join respectively.
create index if not exists catalogue_exercises_category_idx
    on public.catalogue_exercises (category);
create index if not exists catalogue_instructions_locale_idx
    on public.catalogue_instructions (locale);

-- catalogue_page ------------------------------------------------------------
--
-- One page of the catalogue, localised, with English as the fallback. This is
-- the read path: the app calls it through PostgREST as
-- `GET /rest/v1/rpc/catalogue_page?p_locale=hi&p_cursor=...&p_limit=101`.
--
-- It reproduces, exactly, the query the retired Worker ran:
--
--   * `coalesce(i.name, e.name)` gives the localised name where one exists and
--     the English one otherwise.
--   * `name_en` is always English, whatever locale was asked for. The app
--     searches the catalogue on the device, and a Hindi-only index would stop
--     matching the moment somebody typed a Latin word -- which, for gym
--     vocabulary, is most of the time.
--   * Instructions fall back to the English steps when the requested locale has
--     none, so a partly translated catalogue degrades a row at a time rather
--     than returning an exercise with no instructions at all.
--
-- Keyset pagination, never OFFSET: `offset 1200` makes Postgres walk and
-- discard 1,200 rows before returning anything, so the last page would cost far
-- more than the first. `where id > ?` costs the same at every depth, and `id`
-- is already the primary key and already ordered.
--
-- An unrecognised locale needs no validation. It simply misses the `i` join and
-- falls through to English -- which is the degradation we want, and is why the
-- Worker's hard-coded locale allow-list does not need to exist here. Builds
-- released when the app still shipped Spanish, Russian and Chinese still ask
-- for them; they get English rather than an error.
--
-- `security invoker`, not `definer`: row-level security still applies, so this
-- function grants no access the caller did not already have. `stable` is what
-- lets PostgREST serve it over GET.
--
-- It returns a `jsonb` envelope rather than a set of rows, for two reasons.
-- `hasMore` has to be decided somewhere, and deciding it here — where the extra
-- probe row already is — keeps the client from having to know the trick exists.
-- And building the object explicitly lets the keys come out camelCase, which is
-- the shape the app validates; a `returns table` would emit snake_case and buy
-- a renaming step on the other side for nothing.

create or replace function public.catalogue_page(
    p_locale text default 'en',
    p_cursor text default null,
    p_limit  integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
    with bounds as (
        select least(greatest(coalesce(p_limit, 50), 1), 100) as size
    ),
    -- One row more than asked for. The extra row is never returned; its
    -- existence is the whole answer to "is there another page", which is far
    -- cheaper than a second count over the table.
    probed as (
        select
            e.id,
            coalesce(i.name, e.name) as name,
            e.name                   as name_en,
            e.category,
            e.equipment,
            e.primary_muscle_groups,
            e.secondary_muscle_groups,
            e.gif_filename,
            case
                when coalesce(jsonb_array_length(i.steps), 0) > 0 then i.steps
                else coalesce(f.steps, '[]'::jsonb)
            end as instructions
        from public.catalogue_exercises e
        left join public.catalogue_instructions i
            on i.exercise_id = e.id and i.locale = p_locale
        left join public.catalogue_instructions f
            on f.exercise_id = e.id and f.locale = 'en'
        where p_cursor is null or e.id > p_cursor
        order by e.id
        limit (select size from bounds) + 1
    ),
    page as (
        select * from probed order by id limit (select size from bounds)
    )
    select jsonb_build_object(
        'items', coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'id',                    p.id,
                        'name',                  p.name,
                        'nameEn',                p.name_en,
                        'category',              p.category,
                        'equipment',             p.equipment,
                        'primaryMuscleGroups',   p.primary_muscle_groups,
                        'secondaryMuscleGroups', p.secondary_muscle_groups,
                        'gifFilename',           p.gif_filename,
                        'instructions',          p.instructions
                    )
                    order by p.id
                )
                from page p
            ),
            '[]'::jsonb
        ),
        'hasMore', (select count(*) from probed) > (select count(*) from page),
        -- Null unless there is actually another page, so a client that follows
        -- the cursor blindly stops on its own. `id` is the sort key, so the
        -- greatest id in the page is its last row.
        'nextCursor', case
            when (select count(*) from probed) > (select count(*) from page)
                then (select max(id) from page)
            else null
        end
    );
$$;

-- catalogue_categories ------------------------------------------------------
--
-- The categories actually in use, for the CMS's filter and its form dropdown.
--
-- A function because PostgREST cannot express `select distinct`, and pulling
-- 1,324 rows across the wire to collect a handful of strings would be a silly
-- way to fill a select box. It exists to surface a category that has drifted
-- outside the canonical list in the CMS's own `EXERCISE_CATEGORIES`, which is
-- why it reads the data rather than returning a constant.

create or replace function public.catalogue_categories()
returns table (category text)
language sql
stable
security invoker
set search_path = public
as $$
    select distinct e.category from public.catalogue_exercises e order by 1;
$$;

-- Row-level security --------------------------------------------------------
--
-- The opposite model to every other table here, and deliberately so.
--
-- 0001 and 0002 scope each row to `auth.uid()`, so an unauthenticated read
-- returns `200` and an empty array. The catalogue must instead return rows to
-- anyone, signed in or not -- and `using (true)` is the only thing that
-- separates the two cases. A missing or mis-scoped policy here does not error:
-- it yields an empty catalogue with a perfectly healthy `200`, which looks
-- identical to a correctly scoped table and is why the verification step checks
-- for rows explicitly rather than for a status code.
--
-- There is no insert, update or delete policy. RLS denies by default, so the
-- only writers are the seeder and the CMS, both of which authenticate with the
-- secret key and bypass RLS entirely. That key must never reach a client.

do $$
declare
    t text;
begin
    foreach t in array array['catalogue_exercises', 'catalogue_instructions']
    loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists %I on public.%I', t || '_read', t);
        execute format(
            'create policy %I on public.%I for select to anon, authenticated using (true)',
            t || '_read',
            t
        );
    end loop;
end
$$;

grant execute on function public.catalogue_page(text, text, integer) to anon, authenticated;

-- The category list is an admin surface, so it is not offered to clients.
--
-- `anon` and `authenticated` have to be named explicitly. Revoking from PUBLIC
-- alone is not enough on Supabase: the project grants those two roles EXECUTE on
-- functions in `public` directly, through default privileges, so the grant
-- survives a PUBLIC revoke and the function stays reachable with the
-- publishable key.
revoke execute on function public.catalogue_categories() from public, anon, authenticated;
grant execute on function public.catalogue_categories() to service_role;
