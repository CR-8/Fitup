-- The exercises an account has hearted, backed up like everything in 0001.
--
-- Mirrors the local `exercise_favorite` table (src/db/schema/exercise.ts) and
-- is carried by its entry in src/services/backup/tables.ts, so the ordinary
-- sync-queue push writes it and restore brings it back — nothing here is new
-- machinery.
--
-- `id` is `<user id>_<exercise id>`, set by the device, not generated. It is
-- the primary key across every account, and a random id would let the same
-- heart made on two phones land as two rows that a restore then duplicates.
-- `exercise_id` has no foreign key: it may name a catalogue exercise, which
-- lives in `catalogue_exercises`, or a user-authored one in
-- `custom_exercises`, and a favourite outliving a deleted exercise is harmless.

create table if not exists public.exercise_favorites (
    id           text primary key,
    account_id   uuid not null default auth.uid(),
    user_id      text not null,
    exercise_id  text not null,
    created_at   bigint,
    updated_at   bigint,
    synced_at    timestamptz not null default now()
);

create index if not exists exercise_favorites_account_idx
    on public.exercise_favorites (account_id);

alter table public.exercise_favorites enable row level security;

drop policy if exists exercise_favorites_owner on public.exercise_favorites;
create policy exercise_favorites_owner
    on public.exercise_favorites
    for all
    to authenticated
    using (account_id = auth.uid())
    with check (account_id = auth.uid());
