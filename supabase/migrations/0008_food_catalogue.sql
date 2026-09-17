-- The food catalogue: new. `meal_item` (0002) is deliberately freeform text —
-- there was never a catalogue to reference. This adds one, on the same model
-- as `catalogue_exercises` (0004) and its retrieval layer (0005): a reference
-- table anyone can read, an embeddings table only `service_role` can read, and
-- a `match_foods` function the AI diet planner calls the same way
-- `supabase/functions/syn` already calls `match_exercises`.
--
-- `meal_item` is untouched. Logging a meal by typing "150 g chicken breast"
-- keeps working exactly as it does today; this table is additive, for the AI
-- path to draw suggestions from, not a rewrite of how a meal gets logged.

create extension if not exists vector;

-- catalogue_foods ------------------------------------------------------------

create table if not exists public.catalogue_foods (
    id             text primary key,
    name           text not null,
    -- Free text on purpose, same reasoning as catalogue_exercises.category:
    -- a fixed enum would need a migration every time the CMS wants a new one.
    category       text not null default 'other',
    -- Per this serving, not per 100g — matches how meal_item stores macros,
    -- so a matched food's numbers can be copied onto a meal_item unchanged.
    serving_size   text not null,
    calories       real not null default 0,
    protein_g      real not null default 0,
    carbs_g        real not null default 0,
    fat_g          real not null default 0,
    -- Same purpose as catalogue_exercises.is_active: the CMS's publish flag.
    -- No app read path filters on it today because there is no app read path
    -- yet — the AI planner is the only consumer — but match_foods below does.
    is_active      boolean not null default true,
    updated_at     bigint not null
);

create index if not exists catalogue_foods_category_idx
    on public.catalogue_foods (category);

-- food_embeddings -------------------------------------------------------

create table if not exists public.food_embeddings (
    food_id      text primary key
        references public.catalogue_foods (id) on delete cascade,
    content      text not null,
    embedding    vector(384) not null,
    updated_at   timestamptz not null default now()
);

comment on table public.food_embeddings is
    'One row per catalogue food. Written by the CMS''s publish hook via syn-backfill; read by match_foods.';

create index if not exists food_embeddings_hnsw_idx
    on public.food_embeddings
    using hnsw (embedding vector_cosine_ops);

-- match_foods -----------------------------------------------------------

create or replace function public.match_foods(
    p_embedding    vector(384),
    p_match_count  integer default 20
)
returns table (
    id          text,
    name        text,
    category    text,
    similarity  double precision
)
language sql
stable
security invoker
set search_path = public
as $$
    select
        f.id,
        f.name,
        f.category,
        1 - (v.embedding <=> p_embedding) as similarity
    from public.food_embeddings v
    join public.catalogue_foods f on f.id = v.food_id
    where f.is_active
    order by v.embedding <=> p_embedding
    limit greatest(1, least(coalesce(p_match_count, 20), 100));
$$;

comment on function public.match_foods is
    'Vector search over food_embeddings, active foods only. Called with service_role.';

-- Row-level security ----------------------------------------------------
--
-- catalogue_foods is public reference data, same as catalogue_exercises:
-- readable by anyone, writable only by the service-role key (the CMS).
-- food_embeddings is not — same as exercise_embeddings, no public-read case.

alter table public.catalogue_foods enable row level security;

drop policy if exists catalogue_foods_read on public.catalogue_foods;
create policy catalogue_foods_read on public.catalogue_foods
    for select to anon, authenticated using (true);

alter table public.food_embeddings enable row level security;

revoke execute on function public.match_foods(vector, integer)
    from public, anon, authenticated;
grant execute on function public.match_foods(vector, integer)
    to service_role;
