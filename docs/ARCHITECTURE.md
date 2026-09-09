# Architecture

Fitup is a local-first React Native and Expo application. Its product database is SQLite on the device. Network services, native platform APIs, and the watchOS target sit around that local core.

## Data flow

```text
screen, hook, or native target
             |
             v
      CRUD and services
             |
             v
    Drizzle ORM + SQLite
             |
             +---- local queries ----> UI, history, charts
             |
             +---- optional queue ---> Supabase account backup
```

Workout operations commit to SQLite before any optional network work. The normal workout flow does not require an account or a network connection.

## Application layers

### Routes and screens

`src/routes/` contains Expo Router entry points and provider composition. Product screens live under `src/screens/`; reusable UI lives under `src/components/`.

`src/routes/_layout.tsx` starts database migrations and assembles the application's providers, including user state, analytics, notifications, audio, health import, workouts, reviews, and sync.

### Local data

`src/db/schema/` defines the SQLite schema with Drizzle ORM. Generated migrations live under `drizzle/` and run when the application starts.

Product writes belong in `src/crud/`. Screens do not need ad hoc SQL, and the optional sync queue has one consistent boundary.

The main local domains include:

- user preferences;
- exercises;
- workouts and workout groups;
- workout exercises and sets;
- body measurements;
- review-prompt state;
- sync queue and cursor metadata.

### Optional account backup

`EXPO_PUBLIC_SUPABASE_URL` enables accounts. Without it there is no sign-in, no backup, and no exercise catalogue; the local database still works in full.

With an account signed in:

1. local create, update and delete operations append to `sync_queue`;
2. `src/services/backup/push.ts` reads that queue to learn which rows changed, then re-reads those rows from SQLite — the queue's own JSON payload holds stringified dates and superseded edits, so the row is the source of truth, not the log entry;
3. rows are upserted into the account's tables, mapped by `src/services/backup/tables.ts`;
4. settled queue entries are cleaned up.

Restore runs on the first sign-in on a new device, rebuilding the local user row with the id the backed-up rows reference. `supabase/migrations/0001_account_backup.sql` defines the remote schema, and row-level security scopes every row to `auth.uid()`.

### Exercise catalogue

The maintained Fitup exercise catalogue lives in Supabase, in `catalogue_exercises` and `catalogue_instructions`. The client reads it through the `catalogue_page` function, which applies the requested locale and falls back to English for anything untranslated. User-created exercises remain separate through their source and identifiers.

The catalogue is public reference data: its row-level security policy grants `select` to `anon`, so a signed-out install can still fill its library. Nothing has a write policy, so only the seeder and the CMS — which authenticate with the service-role key — can change it.

The catalogue is not bundled with the client. A clean build with no Supabase configured starts without the maintained system catalogue, but users can create exercises and use the workout flow locally.

`src/services/exercise-catalogue.ts` owns the refresh. It writes each page as it arrives, never deletes on failure, and keeps a version marker so a change of shape or source forces exactly one refresh per install.

### Health integrations

The iOS client reads authorised HealthKit data and can write completed workouts. Android uses Health Connect. Missing services or denied permissions must not break the local workout flow.

Authorised body measurements copied into Fitup are stored in the local `measurement` table. Rows with `source: "health"` are backed up in the same way as manual measurement rows.

### Apple Watch and Live Activities

`targets/watch/` contains the SwiftUI watchOS application. `modules/watch-connectivity/` bridges WatchConnectivity messages into the React Native client.

`modules/live-activity/` and `targets/workout-widget/` implement the Live Activity and Dynamic Island surfaces. Native target changes need simulator or physical-device verification in addition to JavaScript checks.

### Analytics, diagnostics, and updates

PostHog is initialised only when its public key and host are configured. Sentry uses `EXPO_PUBLIC_SENTRY_DSN`. Expo Updates uses the EAS project ID from the build configuration.

These services are separate from the account backup. A local-first build can still use any service whose variable is configured.

## State boundaries

- SQLite stores product records and migrations.
- React Query manages asynchronous query state.
- Zustand and React providers manage interaction state.
- MMKV stores small persistent values such as auth and sync metadata fallbacks.
- HealthKit and Health Connect remain external platform stores accessed through user permissions.

Do not store the same persistent product fact in several state systems. Use SQLite for history and other durable records.

## Tests

Jest covers sync flows, API and auth behaviour, health edge cases, review state, exercise search, and selected workout calculations. Run:

```bash
bun run verify
```

Native integrations and store-sensitive behaviour still require platform testing.
