-- In-app feedback (Settings -> Send feedback).
--
-- Insert-only on purpose: the app can write a report for the signed-in user and
-- can never read, change or delete any report, its own included. Reports are read
-- by the team with the service role, which bypasses RLS. Nothing here is health
-- data: `device` is app version, OS and device model, and is only sent when the
-- person leaves "Include device logs" on.
--
-- NOT APPLIED. Review, then run with `supabase db push` (or paste into the SQL
-- editor). Until it exists the app falls back to the mail composer.

create table if not exists public.feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    type text not null check (type in ('bug', 'feature', 'general')),
    message text not null check (char_length(message) between 1 and 4000),
    device jsonb,
    -- Path inside the `feedback-screenshots` bucket, `<user id>/<file>`.
    screenshot_path text,
    created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
    for insert to authenticated
    with check (user_id = auth.uid());

-- Optional screenshot attachments. Private, images only, 5 MB, and a person can
-- only write under their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'feedback-screenshots',
    'feedback-screenshots',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists "feedback_screenshots_insert_own" on storage.objects;
create policy "feedback_screenshots_insert_own" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'feedback-screenshots'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
