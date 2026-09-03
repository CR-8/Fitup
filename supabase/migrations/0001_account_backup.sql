-- Account backup for the profile and the training history.
--
-- The app is local-first: every row below is written to SQLite on the device
-- first and mirrored here afterwards. This schema exists so that reinstalling
-- the app, or signing in on a second phone, does not start from nothing.
--
-- Two conventions are load-bearing:
--
--   * Every `*_at` column is `bigint` holding Unix milliseconds, exactly as
--     SQLite stores it. Timestamps therefore round-trip byte for byte, with no
--     timezone conversion anywhere in the path. `synced_at` is the one
--     exception -- it is server bookkeeping, never read back by the client.
--
--   * Rows keep the 21-character nanoid the device gave them as the primary
--     key, so push and restore are both idempotent and the local foreign keys
--     survive a restore untouched.
--
-- `order` is reserved in Postgres, so the three ordering columns are named
-- `position` here. `src/services/backup/tables.ts` owns that rename.

-- profiles ------------------------------------------------------------------
-- One row per account. `local_user_id` is the id every other table's `user_id`
-- points at; restore recreates the local `user` row with it before anything
-- else, or every restored workout would reference a user that does not exist.

create table if not exists public.profiles (
    account_id      uuid primary key default auth.uid(),
    local_user_id   text not null,
    display_name    text,
    birthday        bigint,
    biological_sex  text,
    created_at      bigint,
    updated_at      bigint,
    synced_at       timestamptz not null default now()
);

-- training_profiles ---------------------------------------------------------
-- Mirrors `ai_profile`. Height and body weight are deliberately absent: they
-- are a time series and live in `measurements`.

create table if not exists public.training_profiles (
    account_id              uuid primary key default auth.uid(),
    local_user_id           text not null,
    goal                    text,
    activity_level          text,
    sessions_per_week       integer,
    session_minutes         integer,
    dietary_pattern         text,
    allergens               jsonb,
    conditions              jsonb,
    equipment               jsonb,
    daily_calorie_target    integer,
    daily_protein_target_g  integer,
    daily_carbs_target_g    integer,
    daily_fat_target_g      integer,
    target_weight_kg        double precision,
    somatotype              text,
    notes                   text,
    completed_at            bigint,
    created_at              bigint,
    updated_at              bigint,
    synced_at               timestamptz not null default now()
);

-- measurements --------------------------------------------------------------

create table if not exists public.measurements (
    id               text primary key,
    account_id       uuid not null default auth.uid(),
    user_id          text not null,
    metric           text not null,
    value            double precision not null,
    unit             text not null,
    recorded_at      bigint not null,
    source           text not null default 'manual',
    source_platform  text,
    external_id      text,
    created_at       bigint,
    updated_at       bigint,
    synced_at        timestamptz not null default now()
);

-- custom_exercises ----------------------------------------------------------
-- User-authored exercises only. The 1,324 catalogue exercises are never sent:
-- they re-seed from Cloudflare D1 on any install. But a restored workout can
-- reference an exercise the user wrote themselves, so those have to travel.

create table if not exists public.custom_exercises (
    id                       text primary key,
    account_id               uuid not null default auth.uid(),
    name                     text not null,
    category                 text not null,
    tracking                 jsonb not null,
    weight_units             text,
    weight_assisted          boolean,
    weight_double_in_stats   boolean,
    distance_units           text,
    distance_activity_type   text,
    distance_track_aw        boolean,
    time_options             text,
    time_halfway_alert       boolean,
    source                   text,
    fitup_source_id          text,
    primary_muscle_groups    jsonb,
    secondary_muscle_groups  jsonb,
    equipment                jsonb,
    mistakes                 jsonb,
    instructions             jsonb,
    description              text,
    difficulty               text,
    gif_filename             text,
    muscle_load              jsonb,
    confidence               text,
    user_id                  text not null,
    created_at               bigint,
    updated_at               bigint,
    synced_at                timestamptz not null default now()
);

-- workouts ------------------------------------------------------------------

create table if not exists public.workouts (
    id            text primary key,
    account_id    uuid not null default auth.uid(),
    name          text not null,
    status        text not null default 'planned',
    start_at      bigint,
    started_at    bigint,
    completed_at  bigint,
    duration      integer,
    remind        text,
    user_id       text not null,
    created_at    bigint,
    updated_at    bigint,
    synced_at     timestamptz not null default now()
);

create table if not exists public.workout_groups (
    id          text primary key,
    account_id  uuid not null default auth.uid(),
    workout_id  text not null,
    type        text not null default 'single',
    position    integer not null,
    notes       text,
    created_at  bigint,
    updated_at  bigint,
    synced_at   timestamptz not null default now()
);

create table if not exists public.workout_exercises (
    id           text primary key,
    account_id   uuid not null default auth.uid(),
    workout_id   text not null,
    exercise_id  text not null,
    group_id     text,
    position     integer,
    created_at   bigint,
    updated_at   bigint,
    synced_at    timestamptz not null default now()
);

create table if not exists public.exercise_sets (
    id                   text primary key,
    account_id           uuid not null default auth.uid(),
    workout_exercise_id  text not null,
    position             integer not null,
    type                 text not null default 'working',
    round                integer,
    weight               double precision,
    weight_units         text,
    reps                 integer,
    time                 integer,
    distance             double precision,
    distance_units       text,
    rpe                  integer,
    rest_time            integer,
    rest_completed_at    bigint,
    final_rest_time      integer,
    started_at           bigint,
    completed_at         bigint,
    created_at           bigint,
    updated_at           bigint,
    synced_at            timestamptz not null default now()
);

-- Restore reads a whole account in one pass per table, so every table is
-- indexed by the column it is filtered on.
create index if not exists measurements_account_idx        on public.measurements (account_id);
create index if not exists custom_exercises_account_idx    on public.custom_exercises (account_id);
create index if not exists workouts_account_idx            on public.workouts (account_id);
create index if not exists workout_groups_account_idx      on public.workout_groups (account_id);
create index if not exists workout_exercises_account_idx   on public.workout_exercises (account_id);
create index if not exists exercise_sets_account_idx       on public.exercise_sets (account_id);

-- Row-level security --------------------------------------------------------
--
-- This is the entire authorization model. The client talks to PostgREST with
-- the user's own access token and never sees another account's rows; there is
-- no server code in this path that could get the check wrong.
--
-- `with check` matters as much as `using`: without it a client could insert a
-- row stamped with somebody else's account_id.

do $$
declare
    t text;
begin
    foreach t in array array[
        'profiles',
        'training_profiles',
        'measurements',
        'custom_exercises',
        'workouts',
        'workout_groups',
        'workout_exercises',
        'exercise_sets'
    ]
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
