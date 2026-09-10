-- Where a device's push token lives, so something server-side can actually
-- send to it. Nothing before this migration could: `epsToken` and
-- `nativeToken` are columns on the local `user` row, and both are listed as
-- `deviceOnly` in src/services/backup/tables.ts on purpose -- "this device
-- describing itself... restoring it onto a different phone would be wrong."
-- That reasoning is sound for account restore, but it means no server-side
-- code has ever been able to see a token to push to. This table is the
-- narrow, purpose-built exception: not a mirror of local SQLite, not part of
-- account restore, just a device telling the project where to reach it.
--
-- Account-gated, unlike the catalogue in 0004. Sending a push needs somewhere
-- durable to read a token back from later, and there is no anonymous
-- equivalent of `auth.uid()` to scope an unauthenticated device's row to --
-- so, like Syn itself, this is a feature that needs a signed-in account.
-- `src/services/push-registration.ts` is the one place that writes it,
-- through the ordinary Supabase client and the user's own session, not
-- through the sync-queue/backup path 0001 and 0002 use: there is no local
-- table to mirror, so there is nothing for that machinery to queue.

create table if not exists public.push_tokens (
    id                text primary key,
    account_id        uuid not null default auth.uid(),
    expo_push_token   text not null,
    -- Base language tag only ('en', 'hi'), matching what the app's own
    -- `resolveLanguageName` (src/ai/prompt.ts) already normalises locales
    -- down to. Determines which language `supabase/functions/push-nudge`
    -- picks a message in.
    locale            text not null default 'en',
    platform          text not null check (platform in ('ios', 'android')),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    unique (account_id, expo_push_token)
);

comment on table public.push_tokens is
    'One row per device registered for remote push. Written by src/services/push-registration.ts; read by supabase/functions/push-nudge.';

create index if not exists push_tokens_account_idx on public.push_tokens (account_id);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner
    on public.push_tokens
    for all
    to authenticated
    using (account_id = auth.uid())
    with check (account_id = auth.uid());

-- due_push_recipients ------------------------------------------------------
--
-- Who a daily nudge should actually reach: someone with a registered device
-- who has not completed a workout yet today, in their own timezone-naive
-- local calendar day. Everyone else already did the thing the notification
-- would have nudged them to do, and pushing them anyway is exactly the kind
-- of untargeted noise that gets an app's notifications turned off entirely.
--
-- `security definer` here, deliberately unlike `catalogue_page` and
-- `match_exercises`: this reads across every account's `workouts` row to
-- decide eligibility, which is not something any single caller's RLS grant
-- covers, and there is no anon or authenticated caller this should ever be
-- reachable by regardless -- see the revoke below. Only `service_role` can
-- call it, exactly the same restriction 0005 puts on `match_exercises`.

create or replace function public.due_push_recipients()
returns table (
    account_id       uuid,
    expo_push_token  text,
    locale           text
)
language sql
stable
security definer
set search_path = public
as $$
    select
        t.account_id,
        t.expo_push_token,
        t.locale
    from public.push_tokens t
    where not exists (
        select 1
        from public.workouts w
        where w.account_id = t.account_id
            and w.status = 'completed'
            and w.completed_at >= extract(epoch from date_trunc('day', now())) * 1000
    );
$$;

comment on function public.due_push_recipients is
    'Devices to nudge today: registered, with no workout completed since local midnight (UTC-approximated). Called only by supabase/functions/push-nudge with service_role.';

revoke execute on function public.due_push_recipients() from public, anon, authenticated;
grant execute on function public.due_push_recipients() to service_role;

-- Scheduling ------------------------------------------------------------
--
-- Not enabled by this migration. `pg_cron` and `pg_net` are both
-- Supabase-provided extensions but are off by default on a new project, and
-- turning them on here would fail the whole migration on a project where
-- they are not yet enabled -- worse than leaving one manual step. Enable both
-- from Database > Extensions in the dashboard, then run once:
--
--   select cron.schedule(
--     'push-nudge-daily',
--     '0 14 * * *',  -- 14:00 UTC; adjust to whenever your audience trains
--     $$
--     select net.http_post(
--       url := 'https://<project-ref>.supabase.co/functions/v1/push-nudge/run',
--       headers := jsonb_build_object(
--         'Authorization',
--         'Basic ' || encode(convert_to('<ADMIN_USER>:<ADMIN_PASSWORD>', 'utf8'), 'base64')
--       )
--     );
--     $$
--   );
--
-- Same basic-auth credentials already set for the CMS and the backfill
-- function (`supabase secrets set ADMIN_USER=… ADMIN_PASSWORD=…`), reused
-- here rather than a fourth secret to manage.
