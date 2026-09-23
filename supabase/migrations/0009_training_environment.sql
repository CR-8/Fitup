-- Where the user trains: 'home' (bodyweight only) or 'gym' (equipment
-- available). Mirrors `ai_profile.trainingEnvironment` in the app's local
-- SQLite (src/db/schema/ai.ts) and is carried by the backup map in
-- src/services/backup/tables.ts, so an existing account picks the column up
-- on its next push without a re-upload.
--
-- Nullable with no default: null means "never asked" and is a real state, not
-- a missing one — see the field's own comment in src/db/schema/ai.ts.

alter table public.training_profiles
    add column if not exists training_environment text;
