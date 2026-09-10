-- Retrieval for Syn: a vector space over the catalogue, and the medical/dietary
-- guidance Syn is trusted to repeat when a condition is declared.
--
-- Both tables are populated and queried from `supabase/functions/syn`, the
-- Edge Function that embeds a user's situation with `gte-small` and asks
-- `match_exercises` for the catalogue rows and guidance passages that actually
-- apply to it. Nothing here runs on the device: pgvector only exists inside
-- Postgres, and `gte-small` only runs inside the Edge runtime that Deno
-- function is written for.
--
-- Everything here is additive. `src/crud/ai/index.ts` still builds a plain,
-- unranked candidate list from the local SQLite catalogue when no retrieval
-- endpoint is configured, exactly as it did before this migration -- so a
-- build with no Syn function deployed keeps working precisely as it does today.

create extension if not exists vector;

-- exercise_embeddings ---------------------------------------------------
--
-- One row per catalogue exercise, keyed on the same id as
-- `catalogue_exercises` so a lookup never has to join on anything but a
-- primary key. `content` is kept beside the vector on purpose: it is exactly
-- what was embedded, and a mismatch between it and the exercise's current
-- name or instructions is how a stale embedding is noticed -- rows are
-- re-embedded, never edited, so this column is what proves whether that
-- happened.
--
-- 384 dimensions because `gte-small` is a 384-dimension model. This is a
-- property of the model, not a tuning choice -- changing the embedding model
-- later means a new column, a full re-embed, and a migration, not an ALTER.

create table if not exists public.exercise_embeddings (
    exercise_id  text primary key
        references public.catalogue_exercises (id) on delete cascade,
    content      text not null,
    embedding    vector(384) not null,
    updated_at   timestamptz not null default now()
);

comment on table public.exercise_embeddings is
    'One row per catalogue exercise. Written by supabase/functions/syn''s backfill route; read by match_exercises.';

-- HNSW over IVFFlat: at the catalogue's current size (~1,300 rows) either
-- costs nothing at query time, but HNSW needs no training step and no `lists`
-- parameter to keep re-tuning as the catalogue grows -- one less thing to get
-- wrong on a table nobody is watching closely.
create index if not exists exercise_embeddings_hnsw_idx
    on public.exercise_embeddings
    using hnsw (embedding vector_cosine_ops);

-- condition_guidance ------------------------------------------------------
--
-- Human-written, ideally clinician-reviewed guidance for a declared condition
-- -- an injury, a diagnosis, an allergen pattern. This is the one table in the
-- retrieval path whose content Syn is allowed to repeat as authoritative
-- rather than generate: `body` is retrieved verbatim into the prompt, and
-- `avoid` is enforced as a hard SQL filter in `match_exercises`, not handed to
-- the model as a suggestion it might not follow.
--
-- Empty on creation. Populating it is explicitly not something this migration
-- can do -- it needs a named list of conditions to support and, for anything
-- medical, a clinician's review of the text. See the seed stub at the bottom:
-- it inserts rows with `body = ''`, which `match_exercises` treats as "not
-- ready to serve" and skips, so an unfilled condition degrades to silence
-- rather than to empty or wrong advice.

create table if not exists public.condition_guidance (
    id          text primary key,
    -- Matches an entry in ai_profile.conditions (src/db/schema/ai.ts), so a
    -- user's declared condition is a direct lookup key, not a fuzzy match.
    condition   text not null,
    locale      text not null default 'en',
    title       text not null,
    body        text not null default '',
    -- Movement patterns to exclude, matched against
    -- catalogue_exercises.primary_muscle_groups / equipment by
    -- match_exercises. Free text by design: the taxonomy a clinician reaches
    -- for ("loaded knee flexion", "axial spinal loading") does not line up
    -- with the catalogue's own muscle-group vocabulary, and forcing one onto
    -- the other would either lose precision or require maintaining a mapping
    -- table nobody asked for. match_exercises does a case-insensitive
    -- substring match against the exercise name and both muscle-group
    -- columns, which is coarse but conservative -- false positives exclude a
    -- safe exercise, false negatives do not, and the coarse direction is the
    -- one that is safe to be wrong in.
    avoid       text[] not null default '{}',
    embedding   vector(384),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (condition, locale)
);

comment on table public.condition_guidance is
    'Human-authored guidance per declared condition. body retrieved verbatim into the prompt; avoid enforced as a hard filter, never a model suggestion.';

create index if not exists condition_guidance_condition_idx
    on public.condition_guidance (condition, locale);

-- match_exercises -----------------------------------------------------------
--
-- The retrieval call itself: semantic similarity, narrowed first by two hard
-- filters that are never left to the model's judgement.
--
--   * `p_equipment` -- when given, a row is excluded unless every item its
--     `equipment` column lists is in the caller's set (bodyweight, an empty
--     equipment list, always passes). Mirrors the exact rule
--     src/crud/ai/index.ts's `buildCandidates` already applies locally, so
--     retrieval and the non-retrieval fallback agree on what "usable
--     equipment" means.
--   * `p_block_patterns` -- when given, a row is excluded if its name or
--     either muscle-group column contains any pattern as a case-insensitive
--     substring. This is the enforcement side of `condition_guidance.avoid`:
--     the caller collects `avoid` across every condition the user declared
--     and passes the union here, so a movement a clinician flagged never
--     reaches the model, rather than reaching it as a instruction it might
--     not follow.
--
-- Both filters are SQL `where` clauses over rows the vector search already
-- ranked, not a post-filter in application code -- an excluded row costs
-- nothing extra to exclude and can never leak through a code path that forgot
-- to check.
--
-- `security invoker`: RLS still applies, though at the time of writing
-- neither table it reads carries a restrictive policy for the service-role
-- caller this function is meant for.

create or replace function public.match_exercises(
    p_embedding       vector(384),
    p_match_count     integer default 60,
    p_equipment       text[] default null,
    p_block_patterns  text[] default null
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
        e.id,
        e.name,
        e.category,
        1 - (v.embedding <=> p_embedding) as similarity
    from public.exercise_embeddings v
    join public.catalogue_exercises e on e.id = v.exercise_id
    where e.is_active
        and (
            -- No declared equipment -- p_equipment null or empty -- means no
            -- filtering at all, matching src/crud/ai/index.ts's
            -- `buildCandidates` exactly: an incomplete profile should still
            -- produce a usable plan rather than an empty candidate set, so
            -- this is deliberately not "bodyweight only".
            p_equipment is null
            or cardinality(p_equipment) = 0
            or jsonb_array_length(e.equipment) = 0
            or (
                select bool_and(item = any(p_equipment))
                from jsonb_array_elements_text(e.equipment) as item
            )
        )
        and (
            p_block_patterns is null
            or not exists (
                select 1
                from unnest(p_block_patterns) as pattern
                where e.name ilike '%' || pattern || '%'
                    or exists (
                        select 1 from jsonb_array_elements_text(e.primary_muscle_groups) m
                        where m ilike '%' || pattern || '%'
                    )
                    or exists (
                        select 1 from jsonb_array_elements_text(e.secondary_muscle_groups) m
                        where m ilike '%' || pattern || '%'
                    )
            )
        )
    order by v.embedding <=> p_embedding
    limit greatest(1, least(coalesce(p_match_count, 60), 100));
$$;

comment on function public.match_exercises is
    'Vector search over exercise_embeddings, narrowed by equipment and condition_guidance.avoid as hard SQL filters. Called by supabase/functions/syn with service_role.';

-- match_condition_guidance --------------------------------------------------
--
-- The companion lookup for declared conditions: a direct, non-vector read,
-- since matching "type_2_diabetes" against a handful of rows does not need a
-- similarity search -- it needs the row with that exact condition, in the
-- user's locale where one exists, falling back to English otherwise. Kept as
-- a function rather than a raw PostgREST filter so the locale fallback lives
-- in one place instead of being reconstructed by every caller.

create or replace function public.match_condition_guidance(
    p_conditions  text[],
    p_locale      text default 'en'
)
returns table (
    condition  text,
    title      text,
    body       text,
    avoid      text[]
)
language sql
stable
security invoker
set search_path = public
as $$
    select distinct on (g.condition)
        g.condition,
        g.title,
        g.body,
        g.avoid
    from public.condition_guidance g
    where g.condition = any(p_conditions)
        and g.body <> ''
    order by g.condition, (g.locale = p_locale) desc, (g.locale = 'en') desc;
$$;

comment on function public.match_condition_guidance is
    'Guidance for a set of declared conditions, in the caller''s locale where written, English otherwise. Rows with an empty body (not yet authored) are skipped.';

-- Row-level security ----------------------------------------------------
--
-- Neither table is public reference data the way the catalogue is -- there is
-- no reason for an anonymous device to read raw vectors or condition text
-- directly, and every legitimate read goes through match_exercises /
-- match_condition_guidance from the Syn function, which holds the
-- service-role key and bypasses RLS entirely. RLS is enabled with no policies
-- at all, which denies every row to anon and authenticated by default -- the
-- safe default for a table with no public-read requirement, unlike the
-- catalogue tables in 0004.

alter table public.exercise_embeddings enable row level security;
alter table public.condition_guidance enable row level security;

revoke execute on function public.match_exercises(vector, integer, text[], text[])
    from public, anon, authenticated;
grant execute on function public.match_exercises(vector, integer, text[], text[])
    to service_role;

revoke execute on function public.match_condition_guidance(text[], text)
    from public, anon, authenticated;
grant execute on function public.match_condition_guidance(text[], text)
    to service_role;
