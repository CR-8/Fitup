-- Server-side AI quota and rate limit, used by `supabase/functions/syn-complete`.
--
-- The on-device quota (a count of plans in local SQLite) stays as a hint in the
-- UI, but it is the device's own claim and a reinstall, a second phone or a
-- patched client defeats it. This is the count the server trusts.
--
-- One row per user per month. `plan_count` is plan builds (requests that ask for
-- a JSON object, which is how the app asks for a plan); `window_start` and
-- `window_count` are a fixed-window rate limit over every request, chat included.
--
-- Written only by the function, with the service role, through `ai_consume`. RLS
-- is on with no policy, so the app, signed in or not, can neither read nor write
-- it directly.
--
-- NOT APPLIED. Review, then run with `supabase db push` (or paste into the SQL
-- editor).

create table if not exists public.ai_usage (
    user_id uuid not null references auth.users (id) on delete cascade,
    month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
    plan_count integer not null default 0 check (plan_count >= 0),
    window_start timestamptz not null default now(),
    window_count integer not null default 0 check (window_count >= 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;

-- Counts one request atomically and says whether it may proceed.
--
-- Returns `{"allowed": true}` or `{"allowed": false, "reason": "monthly_quota" |
-- "rate_limit", "retry_after": <seconds, rate limit only>}`. A request that is
-- refused is not counted, so a person who has run out is not charged for
-- asking again.
create or replace function public.ai_consume(
    p_user uuid,
    p_is_plan boolean,
    p_monthly_limit integer,
    p_rate_limit integer,
    p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
    v_row public.ai_usage;
    v_window_open boolean;
begin
    insert into public.ai_usage (user_id, month)
    values (p_user, v_month)
    on conflict (user_id, month) do nothing;

    -- Lock the row so two simultaneous requests cannot both slip under a limit.
    select * into v_row
    from public.ai_usage
    where user_id = p_user and month = v_month
    for update;

    v_window_open := v_row.window_start + make_interval(secs => p_window_seconds) > now();

    if v_window_open and v_row.window_count >= p_rate_limit then
        return jsonb_build_object(
            'allowed', false,
            'reason', 'rate_limit',
            'retry_after', greatest(
                1,
                ceil(extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - now())))::integer
            )
        );
    end if;

    if p_is_plan and v_row.plan_count >= p_monthly_limit then
        return jsonb_build_object('allowed', false, 'reason', 'monthly_quota');
    end if;

    update public.ai_usage
    set
        plan_count = plan_count + case when p_is_plan then 1 else 0 end,
        window_start = case when v_window_open then window_start else now() end,
        window_count = case when v_window_open then window_count + 1 else 1 end,
        updated_at = now()
    where user_id = p_user and month = v_month;

    return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.ai_consume(uuid, boolean, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid, boolean, integer, integer, integer) to service_role;
