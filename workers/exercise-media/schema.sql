-- Exercise catalogue served by the fitup-exercise-media Worker, on Cloudflare D1.
--
-- Apply with:  bun run db:push
--
-- `id` is the primary key AND the pagination cursor. Keyset pagination needs a
-- unique, ordered column, and this id already matches the one stored in every
-- app install's SQLite, so the two never drift.
--
-- D1 is SQLite, which shapes two columns:
--   - JSON columns are TEXT. The Worker parses them; `asStringArray` in src/db.ts
--     already accepts either a string or an array.
--   - There is no ON UPDATE CURRENT_TIMESTAMP, so `updated_at` is unix seconds
--     written explicitly by the seeder on every upsert.

CREATE TABLE IF NOT EXISTS exercise (
  id                      TEXT    PRIMARY KEY NOT NULL,
  gif_filename            TEXT    NOT NULL UNIQUE,
  name                    TEXT    NOT NULL,
  category                TEXT    NOT NULL,
  equipment               TEXT    NOT NULL,
  primary_muscle_groups   TEXT    NOT NULL,
  secondary_muscle_groups TEXT    NOT NULL,
  cloudinary_public_id    TEXT    NOT NULL,
  -- Cloudinary's asset version, so one animation can be cache-busted without
  -- touching the delivery prefix every client is configured with.
  cloudinary_version      INTEGER NOT NULL,
  secure_url              TEXT    NOT NULL,
  -- The upstream licence caps media at 180x180. Stored so a client can reserve
  -- layout space before the image loads.
  width                   INTEGER NOT NULL,
  height                  INTEGER NOT NULL,
  bytes                   INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);

-- Everything about an exercise that changes with the language. `name` is NULL
-- for English, which is the one name the `exercise` table above already holds;
-- the Worker COALESCEs onto it, so an untranslated locale reads as English
-- rather than as nothing.
--
-- Adding `name` to an existing database is scripts/d1-add-instruction-name.ts,
-- not this file: db-push.ts only runs statements that are safe to repeat.
CREATE TABLE IF NOT EXISTS exercise_instruction (
  exercise_id TEXT NOT NULL,
  locale      TEXT NOT NULL,
  steps       TEXT NOT NULL,
  name        TEXT,
  PRIMARY KEY (exercise_id, locale)
);
