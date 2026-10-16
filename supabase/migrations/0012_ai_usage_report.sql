-- Reports and refunds for the AI plan-build quota in 0011, used by
-- `supabase/functions/syn-complete`.
--
-- `ai_consume` keeps its signature and its decisions. It now also returns the
-- month's `plan_count` (after this request, when it was counted) and the
-- `month` it was counted in, so the function can tell the app how many builds
-- are left (`X-Syn-Builds-Remaining`). The extra keys are additive.
--
-- `ai_refund` gives one plan build back when the build failed before the person
-- got anything: the provider errored, timed out, cut the reply off, or the app
-- hung up. It takes the month the build was counted in, so a build that
-- straddles midnight UTC on the last day is refunded where it was charged. The
-- rate-limit window is not refunded, so failed builds still pace a caller.
--
-- Service role only, like 0011.
--
-- NOT APPLIED. Apply after 0011 with `supabase db push` (or paste into the SQL
-- editor).

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

    if p_is_plan and v_row.plan_count >= p_monthly_limit then
        return jsonb_build_object(
            'allowed', false,
            'reason', 'monthly_quota',
            'plan_count', v_row.plan_count,
            'month', v_month
        );
    end if;

    update public.ai_usage
    set
        plan_count = plan_count + case when p_is_plan then 1 else 0 end,
        window_start = case when v_window_open then window_start else now() end,
        window_count = case when v_window_open then window_count + 1 else 1 end,
        updated_at = now()
    where user_id = p_user and month = v_month
    returning plan_count into v_plan_count;

    return jsonb_build_object('allowed', true, 'plan_count', v_plan_count, 'month', v_month);
end;
$$;

-- Returns the month's `plan_count` after the refund, or null if there is no row.
create or replace function public.ai_refund(p_user uuid, p_month text)
returns integer
language sql
security definer
set search_path = public
as $$
    update public.ai_usage
    set plan_count = greatest(plan_count - 1, 0), updated_at = now()
    where user_id = p_user and month = p_month
    returning plan_count;
$$;

revoke all on function public.ai_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_refund(uuid, text) to service_role;
