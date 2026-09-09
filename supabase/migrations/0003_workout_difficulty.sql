-- How hard a session felt, answered once when the workout is ended.
--
-- Mirrors `workout.difficulty` in the app's local SQLite
-- (src/db/schema/workout.ts) and is carried by the backup map in
-- src/services/backup/tables.ts, so an existing account picks the column up on
-- its next push without a re-upload.
--
-- Nullable with no default and no check constraint: every workout completed
-- before this shipped has no answer, and the three values the app writes
-- ('easy', 'medium', 'hard') are enforced by the local schema's enum. Pinning
-- them here as well would mean a second migration on both sides to add a
-- fourth, for a column the account only ever stores and hands back.

alter table public.workouts
    add column if not exists difficulty text;
