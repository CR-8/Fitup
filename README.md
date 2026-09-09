<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0-22d3ee?style=flat" alt="GPL-3.0 license" />
  &nbsp;
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey?style=flat" alt="Platforms: iOS and Android" />
</p>

<p align="center">
  <strong>Free · Open Source · Local-First · No Subscriptions</strong><br />
  A workout tracker for iPhone, Apple Watch, and Android.
</p>

# Fitup

Fitup is a workout planner and training log built with React Native, Expo, SQLite, and native platform integrations. Its working database lives on the device, so planning a workout, logging sets, and reviewing history do not depend on a server connection.

Signing in with an account adds backup and cross-device restore on top of that local database, through Supabase. Training, logging and history work without one.

The repository contains the mobile client that ships through the stores. It is licensed under GPL-3.0.

## Why Fitup

- Free to use, with no subscription
- Open source under GPL-3.0
- Local-first SQLite storage
- Works offline for the core workout flow
- Optional account backup and restore through Supabase
- Apple Watch workout control
- Live Activities and Dynamic Island on supported iPhones
- HealthKit on iOS and Health Connect on Android

## Get the app

Fitup is not published to the App Store or Google Play yet. Build it from source with the
steps under [Development](#development).

Store builds are intended to be free and subscription-free. Analytics and diagnostics depend
on the release configuration, and the same client can be built without any of these services.

## Features

- Workout planning, live logging, and history
- Working, warm-up, drop, failure, time, and distance sets
- Supersets, trisets, and circuits
- Body measurements and charts
- Automatic measurement import from Apple Health or Google Health Connect
- Configurable rest timers with sound and haptics
- Apple Watch workout control and heart-rate zones
- Configurable maximum-heart-rate formulas: Nes, Fox, Tanaka, Inbar, Gulati, Gellish, or manual
- Live Activity and Dynamic Island support on iOS 16.1 and later
- Exercise history, volume, and personal records
- English, Spanish, Hindi, Russian, and Chinese localisations
- Light, dark, and system themes
- Configurable units: kg or lb, km or mi, cm or in, and Celsius or Fahrenheit

## Local-first data and optional backup

SQLite is the source of truth for the mobile app. Product writes complete locally first.
When an account is signed in, eligible changes are added to `sync_queue` and mirrored to
Supabase in the background, so a reinstall or a second device can restore them.

| Build mode  | Configuration                        | Behaviour                                              |
| ----------- | ------------------------------------ | ------------------------------------------------------ |
| With accounts | `EXPO_PUBLIC_SUPABASE_URL` set      | Local database, plus account backup and restore        |
| Local-only  | Leave `EXPO_PUBLIC_SUPABASE_URL` unset | Local database only; no account, no backup, no catalogue |

The backup is separate from the other optional network integrations. PostHog and Sentry each
have their own environment variable. Leave those unset when building without analytics or
diagnostics. See [Build a local-only client](docs/LOCAL_ONLY.md).

Fitup can copy authorised body measurements from HealthKit or Health Connect into its own
`measurement` table. Those rows follow the same optional backup path as measurements entered
by hand. Fitup does not copy or upload the complete contents of either health store.

## Roadmap

### ① Stable workout core

Polish and harden the full workout experience, from planning and logging to reviewing workout history. This is the foundation everything else builds on.

### ② Whoop-level health intelligence

Deep tracking of recovery, readiness, and training load on par with dedicated wearables. Metrics come from Apple Health on iOS and Google Health Connect on Android. Both collect data from connected devices such as Apple Watch, Garmin, Whoop, Oura, and Polar, so Fitup works with the hardware the user already owns.

### ③ AI-ready tool layer

A set of composable, privacy-first tools designed for AI agents: each tool computes a specific metric or insight (volume load, recovery score, HRV trend, strain index, etc.) and returns the result without ever exposing the underlying raw data to an external system. Source data flows from the user's wearables into Apple Health / Google Health Connect, and only derived, aggregated values leave the device.

### ④ Agentic protocol

An open, vendor-neutral protocol for connecting AI agents to Fitup. An agent can query the tool layer, reason over computed metrics, and surface personalised recommendations regardless of its model or platform. The protocol is deliberately model-agnostic: it defines a contract rather than an implementation, so it can work with a local on-device model, a self-hosted LLM, or a cloud AI service.

### ⑤ First-class agent UI

A native interface for managing and interacting with connected agents inside the app. Users will be able to configure agent access, inspect what each agent can see, and have conversations grounded in their training data without leaving Fitup.

## Architecture

```text
screens, hooks, and native targets
                |
                v
        CRUD and services
                |
                v
       Drizzle ORM + SQLite
                |
                +------ local queries ------> history, charts, next workout
                |
                +------ optional queue -----> Supabase account backup
```

The main implementation areas are:

| Path                       | Responsibility                                                        |
| -------------------------- | --------------------------------------------------------------------- |
| `src/routes/`              | Expo Router entry points and application providers                    |
| `src/screens/`             | Product screens                                                       |
| `src/crud/`                | Local database operations and optional queue writes                   |
| `src/db/` and `drizzle/`   | SQLite schema and migrations                                          |
| `src/services/backup/`     | Account backup and restore through Supabase                          |
| `src/services/`            | Health, authentication, diagnostics, and product services             |
| `modules/`                 | Native Expo modules, including Watch connectivity and Live Activities |
| `targets/watch/`           | SwiftUI watchOS application                                           |
| `targets/workout-widget/`  | Live Activity and widget target                                       |

Read [Architecture](docs/ARCHITECTURE.md) for the data flow and platform boundaries.

## Development

### Requirements

- Node.js 20 or newer
- Bun 1.3 or newer
- Xcode for iOS development
- Android Studio and the Android SDK for Android development
- EAS CLI for remote device builds and store submissions

Fitup uses custom native modules. Expo Go cannot run this project; use a native development build.

### Install

```bash
git clone https://github.com/fitupapp/fitup.git
cd fitup
cp .env.local.example .env.local
bun install --frozen-lockfile
```

The example file uses a development bundle identifier. Set `APP_APPLE_TEAM_ID` to your own Apple Developer team before building the iOS targets. Contributors do not need Fitup production credentials.

### Run

```bash
bun run ios
bun run android
```

### Check a change

```bash
bun run verify
```

This runs ESLint, TypeScript, and the Jest suite. The same commands run for pull requests on GitHub. EAS remains the build and store-release system; GitHub Actions does not build or submit the mobile applications.

### Database migrations

After changing a Drizzle schema:

```bash
bun run db:generate
```

Review and commit the generated migration and metadata. The app applies bundled migrations at startup.

### Useful commands

| Command               | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `bun start`           | Start the Expo development server        |
| `bun run ios`         | Build and run the iOS client locally     |
| `bun run android`     | Build and run the Android client locally |
| `bun run verify`      | Run lint, TypeScript, and tests          |
| `bun run lint`        | Run Expo ESLint                          |
| `bun run typecheck`   | Run TypeScript without emitting files    |
| `bun run test`        | Run Jest in development mode             |
| `bun run db:generate` | Generate a Drizzle migration             |
| `bun run locale`      | Update translation resources             |
| `bun run prebuild`    | Regenerate the local iOS project         |

## EAS builds and releases

The repository includes `eas.json.example`. Copy it to the ignored `eas.json` and add account-specific values before using EAS.

| Command                   | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `bun run build:ios`       | iOS development build through EAS                   |
| `bun run build:android`   | Android development build through EAS               |
| `bun run release:ios`     | Production iOS build and submission through EAS     |
| `bun run release:android` | Production Android build and submission through EAS |
| `bun run update:all`      | Production OTA update and source-map upload         |

Maintainer steps are documented in [Release process](docs/RELEASING.md).

## Contributing

You can contribute code, tests, documentation, translations, accessibility fixes, or
reproducible bug reports. Open an issue on the repository for bugs and scoped work, and
please run `bun run verify` before submitting a change.

## Project documents

- [Architecture](docs/ARCHITECTURE.md)
- [Build a local-only client](docs/LOCAL_ONLY.md)
- [Sync provider protocol](docs/SYNC_PROTOCOL.md)
- [Release process](docs/RELEASING.md)

## Exercise catalogue

The catalogue of 1,324 exercises — names, body parts, equipment, muscle groups, and
step-by-step instructions — is derived from
[exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (© Hasan Emir Yıldırım),
used under the MIT License.

It is not bundled with the app. It lives in Supabase, in `catalogue_exercises` and
`catalogue_instructions`, and the client fetches it on first launch through the
`catalogue_page` function. Reading it needs no account. Regenerate it from the upstream
dataset with `bun run seed`.

**Animations are not included.** The GIFs that accompany that dataset are © Gym visual, not
MIT, and its NOTICE states that cloning the repository grants no rights to the media. To show
animations you must obtain your own rights from
[Gym visual](https://gymvisual.com/content/3-terms-and-conditions-of-use), host the files
yourself, and set `EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL`. Without it the app shows text
instructions only. Where an animation is rendered, the app displays the required
"© Gym visual — gymvisual.com" attribution automatically.

See [assets/exercises/ATTRIBUTION.md](assets/exercises/ATTRIBUTION.md).

## License

Fitup is licensed under the [GNU General Public License v3.0](LICENSE).

Fitup is a rebranded derivative of the Skulpt workout tracker, which is distributed under the
same license. The GPL-3.0 terms carry over to this project and to anything derived from it.
