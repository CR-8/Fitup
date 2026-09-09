# Build a local-only client

Fitup's workout core uses SQLite on the device. Everything that leaves the device — accounts,
backup, and the exercise catalogue — hangs off one variable, `EXPO_PUBLIC_SUPABASE_URL`.

## Configure the environment

Copy the example:

```bash
cp .env.local.example .env.local
```

Leave the Supabase variables empty:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Also leave these optional service variables empty if the build should not initialise
analytics or error reporting:

```dotenv
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

Those two are independent of Supabase. Expo Updates uses `APP_EAS_PROJECT_ID`, and exercise
media can use a remote URL. A build that must make no network requests at all has to leave
every hosted integration unconfigured and review those remaining paths separately.

## Install and run

```bash
bun install --frozen-lockfile
bun run verify
bun run ios
# or
bun run android
```

The iOS project includes an Apple Watch target, so use your own Apple Developer team in
`APP_APPLE_TEAM_ID`. Expo Go is not supported because the project contains custom native
modules.

## Behaviour without Supabase

With `EXPO_PUBLIC_SUPABASE_URL` empty:

- The app never shows a sign-in screen. Accounts cannot be required if there is no account
  backend, so this is the one configuration that reaches the app signed out.
- CRUD operations do not append to `sync_queue` — nothing would ever read the rows.
- Nothing is backed up, and there is nothing to restore on a reinstall.
- The maintained exercise catalogue is not fetched. See below.
- Workouts, custom exercises, sets, measurements and settings all live in SQLite and work in
  full, offline.

Local records do not depend on enabling an account later. Signing in for the first time
adopts the existing local user row rather than creating a second one beside it, so the
training already recorded on the device is kept and becomes the account's history.

## Exercise catalogue

The maintained catalogue of 1,324 exercises is delivered from Supabase, through the
`catalogue_page` function defined in `supabase/migrations/0003_exercise_catalogue.sql`. It is
not bundled with this repository, so a build with no Supabase configured starts without it.

Reading it needs no account — the catalogue is public reference data, fetched with the
publishable key and no session — but it does need a project to read from.

Users can create custom exercises and complete workouts either way. A catalogue-free build
simply has a more limited first run.

## Verify the boundary

Before distributing a local-only build:

1. install it with an empty database;
2. create a custom exercise;
3. plan and complete a workout in airplane mode;
4. relaunch the application and confirm the history remains;
5. inspect network traffic if the release promises to be network-silent;
6. confirm that store and privacy declarations match the exact build configuration.
