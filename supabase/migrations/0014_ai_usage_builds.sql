-- One plan build is one charge, however many requests it takes. Used by
-- `supabase/functions/syn-complete`. Needs 0011 and 0012.
--
-- The app writes a plan in up to four requests: the first try, one retry on a
-- stall or an unusable reply, and the same again over fewer days when the reply
-- ran out of room. 0011 charged every one of them, so a single build that
-- stumbled spent two or three of the month's three, and the app, counting the
-- plans it actually saved, still said three were left when the server refused.
--
-- Now the app sends the build's id (`X-Syn-Build`), and a request carrying the
-- id of the build already charged is let through without a second charge, up
-- to four requests a build. A refund forgets the build, so a retry after a
-- failure that was given back is charged once, as it should be.
--
-- Service role only, like 0011 and 0012.
--
-- NOT APPLIED. Apply after 0012 with `supabase db push` (or paste into the SQL
-- editor), then deploy `syn-complete`.

alter table public.ai_usage add column if not exists build_id text;
alter table public.ai_usage add column if not exists build_requests integer not null default 0;

-- The five-argument version would sit beside the new one as an overload, and
-- a call without `p_build` could then match either.
drop function if exists public.ai_consume(uuid, boolean, integer, integer, integer);

create or replace function public.ai_consume(
    p_user uuid,
    p_is_plan boolean,
    p_monthly_limit integer,
    p_rate_limit integer,
    p_window_seconds integer,
    p_build text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
    v_row public.ai_usage;
    v_window_open boolean;
    v_same_build boolean;
    v_plan_count integer;
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
            ),
            'plan_count', v_row.plan_count,
            'month', v_month
        );
    end if;

    -- A retry of the build already charged, within its four requests.
    v_same_build := p_is_plan
        and p_build is not null
        and v_row.build_id = p_build
        and v_row.build_requests < 4;

    if p_is_plan and not v_same_build and v_row.plan_count >= p_monthly_limit then
        return jsonb_build_object(
            'allowed', false,
            'reason', 'monthly_quota',
            'plan_count', v_row.plan_count,
            'month', v_month
        );
    end if;

    update public.ai_usage
    set
        plan_count = plan_count + case when p_is_plan and not v_same_build then 1 else 0 end,
        build_id = case when p_is_plan then p_build else build_id end,
        build_requests = case
            when v_same_build then build_requests + 1
            when p_is_plan then 1
            else build_requests
        end,
        window_start = case when v_window_open then window_start else now() end,
        window_count = case when v_window_open then window_count + 1 else 1 end,
        updated_at = now()
    where user_id = p_user and month = v_month
    returning plan_count into v_plan_count;

    return jsonb_build_object('allowed', true, 'plan_count', v_plan_count, 'month', v_month);
end;
$$;

revoke all on function public.ai_consume(uuid, boolean, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid, boolean, integer, integer, integer, text) to service_role;

-- As 0012, and the build is forgotten: the next try of it is charged afresh.
create or replace function public.ai_refund(p_user uuid, p_month text)
returns integer
language sql
security definer
set search_path = public
as $$
    update public.ai_usage
    set plan_count = greatest(plan_count - 1, 0), build_id = null, updated_at = now()
    where user_id = p_user and month = p_month
    returning plan_count;
$$;

revoke all on function public.ai_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_refund(uuid, text) to service_role;
