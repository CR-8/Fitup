---
title: "Software Requirements Specification"
subtitle: "Fitup --- Workout Planner, Training Log, and AI Training Assistant"
author: "Fitup Engineering"
date: "Version 1.0 (Draft) --- 7 August 2026"
lang: en
toc: true
toc-depth: 3
numbersections: true
geometry: "margin=2.2cm"
fontsize: 10pt
mainfont: "Cambria"
sansfont: "Calibri"
monofont: "Consolas"
colorlinks: true
linkcolor: "RoyalBlue"
urlcolor: "RoyalBlue"
toccolor: "black"
---

\newpage

# Introduction

## Purpose

This Software Requirements Specification (SRS) defines the complete functional and
non-functional requirements for **Fitup**, a local-first workout planner and training log
for iOS, watchOS, and Android, together with the **AI Training Assistant** module and the
supporting content-management and service infrastructure required to operate it.

The document specifies the system in full: the workout planning and training-log
capabilities that form the product's core, and the AI Training Assistant that builds on
them. It states what the system shall do and the conditions it shall satisfy. It does not
prescribe how those requirements are to be realised, except where a constraint on
implementation is itself a requirement --- as is the case for the safety architecture in
Section 5.13, where the arrangement of components is the control.

## Intended audience

| Audience | Sections of primary interest |
| :--- | :--- |
| Engineering | 3, 4, 5, 6, 7, 9 |
| Content operations | 4.3, 5.14, 8 |
| Product management | 2, 5, 12, 13 |
| Quality assurance | 5, 10, Appendix B |
| Legal and compliance review | 7.3, 8 |
| Infrastructure and operations | 6.3, 7.4, 9 |

## Scope

### In scope

Fitup consists of five deliverable components:

| ID | Component | Status |
| :--- | :--- | :--- |
| C1 | Mobile client (React Native / Expo), iOS and Android | Implemented |
| C2 | watchOS companion application and iOS Live Activity surfaces | Implemented |
| C3 | SyncLayer provider (optional server-side sync and catalogue distribution) | Contract defined; provider operated separately |
| C4 | AI Training Assistant service | New |
| C5 | Content Management System for exercise and nutrition catalogues | New |

The product's defining architectural property is that it is **local-first**. The working
database is SQLite on the device. Planning a workout, logging sets, and reviewing history
never depend on a network connection or an account. All server-side components are
optional enhancements layered over that local core, and the AI Assistant is the first
feature in the product that is genuinely online-only.

### Out of scope

The following are explicitly excluded from this specification:

- Conversational multi-turn chat with the assistant.
- Food photograph recognition and barcode scanning.
- Real-time form correction or coaching during a set.
- Social features: friends, feeds, sharing of plans between users.
- Any diagnostic, therapeutic, or medical claim (see Section 8).
- Web or desktop clients for end users. The CMS is web-based but is a staff tool.

## Definitions, acronyms, and abbreviations

| Term | Definition |
| :--- | :--- |
| **Catalogue** | The curated corpus of exercises and foods, authored in the CMS and distributed to clients. |
| **Constraint** | A hard rule a generated plan must satisfy, e.g. exclusion of spinal loading for a declared lumbar condition. |
| **Generation** | One end-to-end AI plan request. Consumes one unit of the user's monthly quota. |
| **Local-first** | Architecture in which the device database is authoritative for the user's own data and the network is optional. |
| **Plan** | An AI-generated proposal of workouts and, optionally, meals across a horizon of days. |
| **Sync (feature)** | The user action committing a generated plan into the workout schedule. |
| **SyncLayer** | The optional server-side data synchronisation provider. |
| **System exercise** | A catalogue exercise owned by Fitup, identified by the reserved user ID `__fitup__`. |
| **Validator** | The deterministic, non-AI component that verifies a generated plan against constraints. |
| **BMR / TDEE** | Basal Metabolic Rate / Total Daily Energy Expenditure. |
| **RPE** | Rate of Perceived Exertion, a subjective intensity scale recorded per set. |
| **PR** | Personal Record. |

## References

| Ref | Document |
| :--- | :--- |
| R1 | `docs/ARCHITECTURE.md` --- client architecture |
| R2 | `docs/SYNC_PROTOCOL.md` --- sync provider contract |
| R3 | `docs/LOCAL_ONLY.md` --- building without a sync provider |
| R4 | `docs/RELEASING.md` --- release process |
| R5 | `src/db/schema/` --- Drizzle schema definitions |
| R6 | Apple App Review Guidelines, sections 1.4.1, 2.5.1, 5.1.1, 5.1.3 |
| R7 | Google Play Developer Program Policy --- Health apps; Health Connect data-use policy |
| R8 | Regulation (EU) 2016/679 (GDPR), Articles 6, 9, 15--22 |
| R9 | GNU General Public License, version 3.0 |

## Document conventions

Requirement identifiers take the form `FR-<AREA>-<n>` for functional requirements and
`NFR-<AREA>-<n>` for non-functional requirements. Each requirement is atomic and
independently testable.

Priority is expressed with **Must** (required for release), **Should** (required for a
complete product but may follow the initial release), and **May** (desirable).

The key words *must*, *must not*, *should*, and *may* are to be interpreted as described
in RFC 2119.

\newpage

# Overall Description

## Product perspective

Fitup is a self-contained mobile product rather than a component of a larger system. It
depends on no external system for its core function, and it is this independence that the
specification is principally concerned with preserving.

The system shall comprise:

- A tab-based mobile application with four primary sections --- Home, Exercises, Results,
  and Settings --- together with the detail, editor, and modal screens they lead to.
- An on-device relational database holding all user-owned records, versioned by
  migrations applied at application start.
- Native integrations for the watch companion, the live-session lock-screen surface, and
  the workout command channel between them.
- Health platform integration through HealthKit on iOS and Health Connect on Android.
- Localisation into English, Spanish, Hindi, Russian, and Chinese.
- Optional analytics, error reporting, and over-the-air update channels, each
  independently configurable and each disabled by default.
- The AI Training Assistant, together with the service and content-management components
  required to operate it.

The AI Assistant is distinguished from every other capability in this document by three
properties: it is the only user-facing feature that requires a network connection, it is
the only one that requires a structured profile of the user, and it is the only one whose
output can cause physical harm if it is wrong. Each of these carries requirements that do
not arise anywhere else in the product, and the specification treats the module
accordingly rather than as an additive feature.

## Product functions

At the highest level the system provides:

1. **Exercise catalogue management** --- browse, search, filter, and fork a maintained
   catalogue of exercises; create and edit personal exercises.
2. **Workout planning** --- compose workouts from exercises, organised into single
   exercises, supersets, trisets, and circuits, and schedule them.
3. **Live workout execution** --- log sets with weight, repetitions, time, distance, and
   RPE; manage rest periods; control the session from an Apple Watch or the Dynamic Island.
4. **Body measurement tracking** --- record measurements manually or import them from the
   platform health store; visualise trends.
5. **Results and analysis** --- review history, training volume, personal records, and
   per-exercise statistics.
6. **AI plan generation** --- produce a personalised training and nutrition plan from
   the user's profile, history, stated intent, and the curated catalogue, subject to hard
   safety constraints, and commit it to the schedule.
7. **Optional synchronisation** --- replicate the local database to a compatible provider
   and receive the maintained exercise catalogue.
8. **Content operations** --- author and govern the catalogue and its conditional
   safety metadata.

## User classes and characteristics

| Class | Description | Technical expertise | Frequency of use |
| :--- | :--- | :--- | :--- |
| **Casual trainee** | Follows a simple routine, logs sets, tracks weight. Primary audience. | Low | 2--4 sessions/week |
| **Experienced lifter** | Uses supersets, RPE, drop sets; reviews volume and PRs closely. | Medium | 4--6 sessions/week |
| **Rehabilitation-constrained user** | Trains around a declared condition. Highest safety sensitivity. | Low | Variable |
| **Content editor** | Client staff authoring catalogue entries and conditional rules. | Medium | Daily |
| **Content reviewer** | Senior staff approving safety-relevant rules before publication. | Medium; domain-qualified | Weekly |
| **Support and operations** | Fitup staff investigating generations, quota, and failures. | High | As required |

The rehabilitation-constrained class deserves particular emphasis. It is the class the AI
Assistant is most valuable to and the class it can most harm. Requirements throughout this
document that concern contraindication handling exist to serve this class safely.

## Operating environment

| Attribute | Requirement |
| :--- | :--- |
| iOS | 16.1 or later (Live Activities require 16.1; Dynamic Island requires supporting hardware) |
| watchOS | Paired Apple Watch, watchOS 9 or later |
| Android | API level 26 (Android 8.0) minimum; compile SDK 36, target SDK 35 |
| Device storage | Approximately 150 MB application, plus catalogue media cached on demand |
| Network | Not required for core function; required for sync, catalogue updates, and AI generation |
| Backend | Linux containers on AWS; PostgreSQL 15 or later |

## Design and implementation constraints

| ID | Constraint |
| :--- | :--- |
| DC-1 | The core workout flow must remain fully functional with no network and no account. This constrains every feature added to the product, including the AI Assistant. |
| DC-2 | The client is licensed GPL-3.0. Client modifications are derivative works and must remain GPL-3.0 and be published (see Section 8.4). |
| DC-3 | The local database is SQLite via Drizzle ORM. Schema changes require generated migrations that run at application start. |
| DC-4 | Sync shall use the documented contract with the `x-fitup-sync-schema` compatibility header. New server-owned data should reuse this contract rather than introduce a parallel mechanism. |
| DC-5 | LLM provider credentials must never be present in the client binary, the repository, or the CMS. |
| DC-6 | Health data obtained from HealthKit or Health Connect is subject to platform data-use restrictions that are stricter than the application's own privacy policy. |
| DC-7 | The client is built and released through EAS; native module changes require a new binary and cannot be delivered over the air. |

## Assumptions and dependencies

| ID | Assumption |
| :--- | :--- |
| A-1 | Users have network connectivity at the moment of AI plan generation. Generation is the only online-only user-facing feature. |
| A-2 | The catalogue is curated by qualified humans and is authoritative on safety. The model selects from it; it never invents an exercise or food. |
| A-3 | Users self-declare conditions honestly, and may decline to declare any. |
| A-4 | Generated plans are general fitness guidance, not medical guidance. |
| A-5 | An LLM provider is available under commercial terms including zero data retention and no training on submitted data. |
| A-6 | A qualified professional accepts named ownership of the clinical correctness of contraindication rules (see Section 13, Q4). |

Assumption A-6 is currently **unsatisfied** and is the highest-severity open item in this
document.

\newpage

# System Architecture

## Architectural overview

```
+-------------------+       +---------------------+       +------------------+
|   Fitup CMS       | write |  Content database   |  read |   AI service     |
|   (web, staff)    +------>+  (PostgreSQL)       +<------+   (container)    |
+-------------------+       +----------+----------+       +--------+---------+
                                       |                           |
                                       | catalogue publish         | LLM call
                                       v                           v
                            +----------+----------+       +--------+---------+
                            |  SyncLayer provider |       |  LLM provider    |
                            +----------+----------+       +------------------+
                                       |
                        HTTPS + bearer | x-fitup-sync-schema: 2
                                       v
+----------------------------------------------------------------------+
|                        Fitup mobile client                            |
|                                                                       |
|  routes / screens  ->  hooks  ->  CRUD + services  ->  Drizzle/SQLite |
|                                        |                              |
|                                        +--> sync queue (optional)     |
|                                        +--> HealthKit / Health Connect|
|                                        +--> WatchConnectivity         |
|                                        +--> Live Activity             |
+----------------------------------------------------------------------+
```

## Client layer model

The client follows a strict layering, described in R1 and preserved by this
specification.

| Layer | Location | Responsibility |
| :--- | :--- | :--- |
| Routes | `src/routes/` | Expo Router entry points; provider composition |
| Screens | `src/screens/` | Product screens, one directory per feature area |
| Components | `src/components/` | Reusable presentational and primitive UI |
| Hooks | `src/hooks/` | React state and data-access hooks |
| Queries | `src/queries/` | TanStack Query definitions |
| CRUD | `src/crud/` | All product writes; the single boundary at which sync enqueuing occurs |
| Services | `src/services/` | Platform integrations: health, watch, live activity, auth, notifications |
| Sync | `src/sync/` | Queue compaction, push, pull, backfill |
| DB | `src/db/` | Drizzle schema and connection |
| Stores | `src/stores/` | Zustand client state |
| Storage | `src/storage/` | MMKV key-value persistence |

**FR-ARC-1 --- Must.** All product writes must pass through `src/crud/`.
Screens must not issue ad hoc SQL. This guarantees a single, consistent point at which
sync-queue entries are created.

**FR-ARC-2 --- Must.** The AI Assistant's plan commit must use the CRUD
functions for `workout`, `workoutGroup`, and `workoutExercise`. It must not introduce a
second write path into the workout domain.

## Technology stack

| Concern | Technology |
| :--- | :--- |
| Application framework | React Native 0.86, React 19.2, Expo SDK 57 |
| Navigation | Expo Router 57 (typed routes) |
| Local database | SQLite via `expo-sqlite`; Drizzle ORM 0.45 |
| Server state | TanStack Query 5 |
| Client state | Zustand 5 |
| Key-value storage | `react-native-mmkv` 4 |
| Styling | `react-native-unistyles` 3 |
| Forms and validation | React Hook Form 7, Zod 4 |
| Animation | Reanimated 4, Worklets |
| Charts | `react-native-gifted-charts` |
| Internationalisation | i18next 26, `react-i18next` 17, `expo-localization` |
| Health | `@kingstinct/react-native-healthkit`, `react-native-health-connect` |
| Analytics | PostHog (optional) |
| Diagnostics | Sentry (optional) |
| Backend service | Node.js or Python container; PostgreSQL 15 |
| Model provider | OpenAI `gpt-4o-mini` (see 5.13.2) |

\newpage

# Data Requirements

## Core local schema

The device database shall hold the following tables. Primary keys shall be 21-character
NanoIDs. All product tables shall carry `createdAt` and `updatedAt` timestamps in epoch
milliseconds, and all schema changes shall be delivered as generated migrations applied
at application start.

| Table | Purpose | Notable columns |
| :--- | :--- | :--- |
| `user` | Device, locale, notification, and unit preferences | `theme`, `weightUnits`, `distanceUnits`, `timeZone`, notification capability flags |
| `exercise` | Exercise catalogue, both system and user-authored | `category`, `tracking[]`, `primaryMuscleGroups[]`, `secondaryMuscleGroups[]`, `equipment[]`, `instructions[]`, `mistakes[]`, `muscleLoad`, `difficulty`, `gifFilename`, `source`, `fitupSourceId`, `userId` |
| `workout` | A planned or executed session | `status` (`planned`/`in_progress`/`completed`/`cancelled`), `startAt`, `startedAt`, `completedAt`, `duration`, `remind` |
| `workout_group` | Grouping within a workout | `type` (`single`/`superset`/`triset`/`circuit`), `order`, `notes` |
| `workout_exercise` | An exercise instance within a workout | `workoutId`, `exerciseId`, `groupId`, `orderInGroup` |
| `exercise_set` | A single set | `type` (`warmup`/`working`/`dropset`/`failure`), `weight`, `reps`, `time`, `distance`, `rpe`, `restTime`, `startedAt`, `completedAt` |
| `measurement` | Body metrics, manual or imported | `metric`, `value`, `unit`, `recordedAt`, `source` (`manual`/`health`), `sourcePlatform`, `externalId` |
| `app_review` | Review-prompt state machine | --- |
| `sync_queue` | Pending outbound operations | `tableName`, `recordId`, `operation`, `data`, `timestamp`, `synced` |
| `sync_metadata` | User-scope pull cursor | `lastSyncTimestamp` |
| `fitup_sync_metadata` | Catalogue pull cursor, keyed by locale | `locale`, `lastSyncTimestamp` |

The `exercise` table carries the metadata surface on which intelligent selection depends
--- muscle groups, equipment, difficulty, and a structured `muscleLoad` profile. These
attributes shall be populated for all catalogue content and shall be distributed to
clients through the catalogue pull scope defined in 5.12.

## Data domains required by the AI Assistant

The assistant depends on three data domains beyond the core schema. Each is a
prerequisite for the module rather than a refinement of it, and together they represent a
larger body of work than the generation logic itself. Section 12 schedules them
accordingly.

### Structured fitness profile

The core `user` table is scoped to device, locale, and unit preferences, and the
`measurement` table to time-series body metrics. Neither is an appropriate home for goal,
activity level, dietary pattern, equipment access, or declared condition, all of which
are single-valued attributes of the person rather than device settings or dated
observations.

A dedicated profile domain shall therefore be provided (4.3.1), together with the
onboarding flow that populates it (5.2).

### Nutrition

The assistant's nutrition output requires a food and meal domain: a catalogue of foods
with macronutrient composition and dietary classification, and a structure for the meals
composed from them. This domain shall support authoring in the CMS, distribution through
the catalogue scope, generation, validation, and presentation (4.3.2).

### Contraindication metadata

The `exercise` and `food` tables describe what an item *is* --- muscles worked, equipment
required, macronutrients supplied. Neither describes who an item is *unsafe for*.

A relation layer keyed to a controlled condition vocabulary shall therefore be provided
(4.3.3). This layer is what the safety filtering in 5.13.4 operates on; without it, that
filtering has nothing to filter against and the guarantee in 5.13.1.4 cannot be made.

## Supporting schema

### Profile

| Table | Columns |
| :--- | :--- |
| `user_profile` | `userId` (PK), `dateOfBirth`, `sex`, `heightCm`, `goal` (`lose`/`maintain`/`gain`/`recomp`), `activityLevel`, `sessionsPerWeek`, `sessionMinutes`, `dietaryPattern`, `derivedBmr`, `derivedTdee`, `profileVersion`, timestamps |
| `user_equipment` | `userId`, `equipmentKey` --- the equipment the user can actually access |
| `user_condition` | `userId`, `conditionKey`, `declaredAt` --- self-declared conditions from the controlled vocabulary |
| `user_allergen` | `userId`, `allergenKey` |

### Nutrition

| Table | Columns |
| :--- | :--- |
| `food` | `id` (PK), `name`, `servingSize`, `servingUnit`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fibreG`, `tags[]`, `dietaryFlags[]`, `allergens[]`, `source`, `userId`, timestamps |
| `meal` | `id` (PK), `userId`, `date`, `slot` (`breakfast`/`lunch`/`dinner`/`snack`), `order`, timestamps |
| `meal_item` | `id` (PK), `mealId`, `foodId`, `servings`, timestamps |

### Catalogue governance

| Table | Columns |
| :--- | :--- |
| `condition` | `key` (PK), `label`, `description`, `severity` --- the controlled vocabulary |
| `exercise_condition` | `exerciseId`, `conditionKey`, `relation` (`indicated`/`contraindicated`), `note` |
| `food_condition` | `foodId`, `conditionKey`, `relation`, `note` |

### AI

| Table | Columns |
| :--- | :--- |
| `ai_plan` | `id` (PK), `userId`, `intent`, `note`, `horizonDays`, `planJson`, `modelId`, `promptVersion`, `validatorResult`, `createdAt`, `committedAt`, `expiresAt` |
| `ai_quota_ledger` | `id` (PK), `userId`, `periodStart`, `consumed`, `limit`, `updatedAt` --- server-side only |

**FR-DAT-1 --- Must.** `ai_quota_ledger` must exist only on the server. It must
never be replicated to the device, because a client-side quota record is a client-side
quota control (see 5.13.7).

**FR-DAT-2 --- Must.** `condition`, `exercise_condition`, and `food_condition` are
server-owned catalogue content. They must be distributed through the existing `fitup`
pull scope, not authored on the device.

**FR-DAT-3 --- Must.** All new user-owned tables must participate in the existing
sync queue using the established `src/crud/` boundary.

\newpage

# Functional Requirements

## Identity and accounts

**FR-IDN-1 --- Must.** The application must be fully usable without an
account. A local user record is created on first launch.

**FR-IDN-2 --- Must.** When a sync provider is configured, the client
obtains a bearer token via `POST /auth/token` using the local user ID and a persistent
device ID, and stores it in MMKV with an in-memory fallback for the current launch.

**FR-IDN-3 --- Must.** On a `401` response the client must clear the stored
token, request a new one, and retry the failed request exactly once.

**FR-IDN-4 --- Must.** AI generation requires an authenticated user. If no provider
is configured, the AI entry point must be hidden rather than shown in a failing state.

## Onboarding and profile

**FR-PRO-1 --- Must.** Onboarding must capture date of birth, sex, height, current weight,
target weight, goal, activity level, sessions per week, and typical session length.

**FR-PRO-2 --- Must.** Onboarding must capture available equipment from the controlled
equipment vocabulary defined for `exercise.equipment`.

**FR-PRO-3 --- Must.** Onboarding must capture dietary pattern and allergen exclusions.

**FR-PRO-4 --- Must.** Onboarding must capture self-declared conditions from the
controlled vocabulary, with an explicit and clearly presented *none* option.

**FR-PRO-5 --- Must.** Condition and allergen capture must be optional. A user who
declines must still be able to generate a plan; the plan is then generated under
general-population constraints.

**FR-PRO-6 --- Must.** Onboarding must be skippable in full. A user who skips retains
complete access to all non-AI functionality, in accordance with DC-1.

**FR-PRO-7 --- Must.** Every profile field must be editable afterwards from Settings.
Editing must increment `profileVersion` and invalidate any cached generation context.

**FR-PRO-8 --- Must.** Height and weight must continue to write to `measurement` so that
existing charts, health import, and history remain correct and unduplicated.

**FR-PRO-9 --- Should.** The client should derive BMR and TDEE locally using the
Mifflin-St Jeor equation and transmit the derived values rather than the raw inputs where
the raw inputs are not otherwise required.

## Exercise catalogue

**FR-EXC-1 --- Must.** Users must be able to browse, search, and filter
exercises by category, muscle group, and equipment.

**FR-EXC-2 --- Must.** Users must be able to create, edit, and delete
personal exercises.

**FR-EXC-3 --- Must.** System exercises (`userId = '__fitup__'`) must not be
directly editable or deletable. Editing a system exercise must fork it into a
user-owned copy with `fitupSourceId` set to the source, and existing workout references
must be remapped to the fork.

**FR-EXC-4 --- Must.** Exercise animations must load from the configured
media base URL at thumbnail (180 px) and preview (1080 px) resolutions. The base URL must
be overridable by environment variable.

**FR-EXC-5 --- Should.** Exercise detail must present instructions, common
mistakes, primary and secondary muscle groups, equipment, and difficulty.

**FR-EXC-6 --- Must.** Exercise detail must display declared contraindications when
the viewing user has a matching declared condition, with a clear, non-alarming
explanation.

## Workout planning

**FR-WKP-1 --- Must.** Users must be able to create a workout, name it, add
exercises, and reorder them.

**FR-WKP-2 --- Must.** Exercises must be groupable as single, superset,
triset, or circuit, with ordering preserved within the group.

**FR-WKP-3 --- Must.** Workouts must be schedulable via `startAt`, with an
optional reminder offset of start, 5 m, 10 m, 15 m, 30 m, 1 h, or 2 h.

**FR-WKP-4 --- Must.** A workout must hold exactly one of the statuses
`planned`, `in_progress`, `completed`, or `cancelled`.

**FR-WKP-5 --- Should.** Users must be able to duplicate an existing workout.

## Live workout execution

**FR-WKE-1 --- Must.** Starting a workout must transition it to
`in_progress` and record `startedAt`.

**FR-WKE-2 --- Must.** Sets must support the types `warmup`, `working`,
`dropset`, and `failure`.

**FR-WKE-3 --- Must.** Set logging must support weight, repetitions, time,
distance, and RPE according to the parent exercise's `tracking` configuration.

**FR-WKE-4 --- Must.** Completing a set must record `completedAt` and, where
a rest time is configured, begin the rest timer.

**FR-WKE-5 --- Must.** Rest timers must support configurable duration,
sound, and haptic feedback, and must survive application backgrounding.

**FR-WKE-6 --- Must.** All writes during a live workout must commit to SQLite
before any network activity is attempted.

**FR-WKE-7 --- Should.** The screen must optionally remain awake during a
workout, under user control.

**FR-WKE-8 --- Must.** Completing a workout must set `completedAt` and compute
`duration`.

## Body measurements

**FR-MEA-1 --- Must.** Users must be able to record body metrics manually
with a value, unit, and timestamp.

**FR-MEA-2 --- Must.** Authorised measurements must import from HealthKit or
Health Connect, recorded with `source = 'health'` and the originating platform.

**FR-MEA-3 --- Must.** Imported measurements must be deduplicated on
`(userId, source, metric, externalId)`.

**FR-MEA-4 --- Should.** Measurements must be presented as trend charts over
a selectable range.

## Results and analysis

**FR-RES-1 --- Must.** Users must be able to review completed workouts by day
and by month.

**FR-RES-2 --- Must.** The system must compute per-exercise history, training
volume, and personal records.

**FR-RES-3 --- Should.** Results must present activity summaries, strength
progression, and body-weight trend.

**FR-RES-4 --- Should.** Where a workout originated from an AI plan, results must
indicate this and link to the originating plan.

## Health platform integration

**FR-HLT-1 --- Must.** On iOS the client must read authorised HealthKit data
and may write completed workouts.

**FR-HLT-2 --- Must.** On Android the client must integrate Health Connect
equivalently.

**FR-HLT-3 --- Must.** Absent services or denied permissions must never break
the local workout flow. All health integration is strictly additive.

**FR-HLT-4 --- Should.** Heart-rate zones must be computed from a
user-selected maximum-heart-rate formula: Nes, Fox, Tanaka, Inbar, Gulati, Gellish, or a
manual value.

**FR-HLT-5 --- Must.** Health-derived data must not be transmitted to the LLM
provider unless the user has given separate, explicit, informed consent. See FR-CMP-6.

## Apple Watch and Live Activities

**FR-WAT-1 --- Must.** The watchOS application must display the active
workout and permit set completion and rest control.

**FR-WAT-2 --- Must.** Watch and phone state must remain consistent through
WatchConnectivity messaging.

**FR-WAT-3 --- Must.** On iOS 16.1 and later the active workout must present
a Live Activity, including Dynamic Island on supporting hardware.

**FR-WAT-4 --- Should.** The Live Activity must expose set completion and
rest control as interactive intents.

## Notifications

**FR-NOT-1 --- Must.** Scheduled workouts must raise a local notification at
the configured reminder offset.

**FR-NOT-2 --- Must.** Rest completion must raise a notification when the
application is backgrounded.

**FR-NOT-3 --- Must.** All notification categories must be individually
controllable in Settings.

## Settings, units, and localisation

**FR-SET-1 --- Must.** Theme must be selectable as light, dark, or system.

**FR-SET-2 --- Must.** Units must be independently configurable: body weight
(kg/lb), training weight (kg/lb), distance (km/mi), measurement (cm/in), temperature
(C/F).

**FR-SET-3 --- Must.** The interface must be localised into English, Spanish,
Hindi, Russian, and Chinese, following the device locale by default with manual override.

**FR-SET-4 --- Must.** Date, time, first weekday, and time format must be
configurable.

**FR-SET-5 --- Must.** Settings must expose AI Assistant controls: remaining quota,
generation history, profile editing, and a complete opt-out.

**FR-SET-6 --- Must.** Opting out of the AI Assistant must delete the stored profile
and generation history and hide the AI entry point entirely.

## Synchronisation

**FR-SYN-1 --- Must.** Sync must be entirely optional, selected at build time
by `EXPO_PUBLIC_SYNC_HOST`. Without it the client must not mount the sync provider,
authenticate, or enqueue operations.

**FR-SYN-2 --- Must.** Local create, update, and delete operations must
enqueue to `sync_queue`; the engine must compact compatible operations per record before
transmission.

**FR-SYN-3 --- Must.** Requests must carry `x-fitup-sync-schema: 2`. A
provider must reject an unsupported schema version rather than silently accept an
incompatible payload.

**FR-SYN-4 --- Must.** The maintained catalogue must pull through a separate
`fitup` scope with a per-locale cursor, distinct from the user-data cursor.

**FR-SYN-5 --- Must.** User-authored exercises must remain distinguishable
from catalogue exercises by `source` and `userId`.

**FR-SYN-6 --- Must.** New nutrition and profile tables must extend the existing
protocol under the same schema-version discipline. A schema change requires incrementing
the header value.

\newpage

## AI Training Assistant

This section specifies the module that is the subject of the current development phase.
It begins with four findings that alter the design proposed in the originating brief.

### Findings that alter the proposed design

#### Model parameters as briefed are invalid

The brief specifies *"temperature 200 and 0.4 as token limit."* These values are
transposed, and the token figure is unusable in either arrangement.

| Parameter | As briefed | Valid range | Specified |
| :--- | :--- | :--- | :--- |
| `temperature` | 200 | 0.0--2.0 | **0.4** |
| `max_output_tokens` | 0.4 | 1--16,384 | **3,000** |

A temperature of 200 is rejected by the API. More consequentially, **200 output tokens
cannot contain a plan.** Two hundred tokens is roughly 150 words --- less than one meal
entry with macronutrients. A seven-day plan with exercises, sets, meals, and rationale
measures 1,800--2,800 output tokens in practice.

Temperature 0.4 is a sound choice and is adopted: low enough for consistent structured
output, high enough that a user does not receive an identical plan every month.

#### A client-only design cannot ship

The brief proposes handling generation in the client, with *"not a lot of backend APIs."*
This is not viable for three independent reasons.

1. **Credential exposure.** Any secret bundled into a React Native binary --- environment
   variable, obfuscated constant, or native module --- is extractable from the IPA or APK.
   A leaked key is billed to the account holder until revoked and is discovered by
   automated scanners within hours of publication.
2. **Unenforceable quota.** A monthly limit enforced in client code is enforced by the
   attacker. Quota must be counted server-side against an authenticated identity.
3. **Catalogue distribution.** See 5.13.1.3.

A server component is therefore mandatory. It is, however, genuinely small: one
authenticated endpoint performing a quota check, a retrieval query, a model call, and a
validation pass. This is not the broad API surface the brief sought to avoid, and the
client remains local-first for every other feature.

#### The catalogue cannot be placed in the system prompt

The brief proposes including *"a very big catalog of foods and everything"* in the system
prompt. At a realistic 5,000 foods at approximately 30 tokens each, this is roughly
150,000 tokens --- **exceeding the 128,000-token context window of `gpt-4o-mini`**, so the
request fails outright rather than degrading.

Even where it fits, the economics are decisive:

| Approach | Input tokens per generation | Cost per generation | 10,000 users x 3/month |
| :--- | ---: | ---: | ---: |
| Full catalogue in prompt | ~150,000 | ~$0.024 | ~$675/month |
| **Retrieval (specified)** | ~4,000 | ~$0.0024 | **~$72/month** |

Retrieval is specified in 5.13.4. It also improves quality: a smaller, better-targeted
candidate set yields more consistent selection than a corpus the model must scan.

#### Constraint adherence cannot be delegated to the model

The brief states that *"AI must always follow the constraints."* No language model offers
that guarantee. Prompting reduces violation rates; it does not eliminate them. Because
this module recommends physical exercise to users who have declared conditions such as
lumbar injury, a violation is a physical-safety event and a store-compliance event.

A deterministic validator is therefore specified in 5.13.5. **The model proposes; the
validator disposes.** No plan reaches a user in a violating state.

### Model configuration

| Setting | Value |
| :--- | :--- |
| Model | `gpt-4o-mini` |
| `temperature` | 0.4 |
| `max_output_tokens` | 3,000 |
| `response_format` | Strict JSON Schema |
| Timeout | 30 s |
| Retry | One, on transport error or schema-validation failure only |

**FR-AIA-1 --- Must.** The model identifier must be a runtime configuration value, not a
compile-time constant.

**FR-AIA-2 --- Should.** At least one alternative model must be benchmarked against the
Section 10 acceptance suite before launch. Provider selection should follow the measured
constraint-violation rate, which is the metric that governs safety here, rather than
list price or general benchmark performance.

### Prompt composition

Four layers, assembled server-side:

1. **System layer** --- role definition, hard rules, refusal conditions, and output
   contract. Static and versioned.
2. **Few-shot layer** --- three to five curated exemplars covering a straightforward
   bulking plan, a cut with dietary exclusions, and a plan with an active
   contraindication. Static and versioned.
3. **Retrieved context** --- the candidate exercises and foods for this specific request.
4. **User context** --- profile, derived energy targets, recent training history, and the
   stated intent.

**FR-AIA-3 --- Must.** Layers 1 and 2 must be versioned artefacts held in the repository
and changed only through code review. A prompt change is a release and carries the same
process weight as a code change.

**FR-AIA-4 --- Must.** Every generation record must store the prompt version used, so that
any plan can be reproduced and any regression bisected.

### Retrieval

**FR-AIA-5 --- Must.** The service must resolve the user's hard exclusions --- declared
conditions, allergens, dietary pattern, and absent equipment --- into a database filter.

**FR-AIA-6 --- Must.** Candidate selection must apply that filter **in SQL**. Excluded
items must never be included in the prompt. *This is the primary safety mechanism; the
prompt is secondary.*

**FR-AIA-7 --- Must.** Only `published` catalogue content may be retrieved.

**FR-AIA-8 --- Should.** Remaining candidates should be ranked by goal fit and by variety
relative to recent training history, taking approximately the top 60 exercises and 120
foods, tuned to hold assembled input near 4,000 tokens.

The governing property is that **an item a user must not receive is removed before the
model is aware of it.** A model cannot select what it was never shown.

### Validation

**FR-AIA-9 --- Must.** Every generated plan must pass a deterministic validator before
display. The validator is ordinary code and must not invoke a model.

| Check | Action on failure |
| :--- | :--- |
| Every `exerciseId` and `foodId` exists in the supplied candidate set | Reject |
| No item contraindicated for a declared condition | Reject |
| No item violating a declared allergen or dietary pattern | Reject |
| No equipment the user does not have | Repair --- substitute nearest permitted item |
| Daily energy within 10% of derived target | Repair --- adjust servings |
| Protein within 15% of target | Repair |
| Weekly session count matches stated availability | Repair --- drop lowest-priority day |
| No consecutive-day loading of the same primary muscle group | Repair --- reorder |

**FR-AIA-10 --- Must.** A rejection must trigger exactly one regeneration with the
violation fed back into context. A second rejection must fail the request.

**FR-AIA-11 --- Must.** A failed request must not consume quota.

**FR-AIA-12 --- Must.** Every rejection must be logged with the violating item and the
rule violated, so that content operations can locate the catalogue gap responsible.

### Generation flow

**FR-AIA-13 --- Must.** The user initiates generation from a visible entry point and
states an intent.

**FR-AIA-14 --- Must.** Intent must be selected from presets, with an optional free-text
note limited to 200 characters.

**FR-AIA-15 --- Must.** Quota must be checked before the model is called.

**FR-AIA-16 --- Must.** The plan must be presented as a preview, not committed, with a
per-item rationale explaining why each item was selected.

**FR-AIA-17 --- Must.** The preview must display remaining quota and the reset date.

**FR-AIA-18 --- Should.** Generation must be cancellable, and a cancelled generation must
not consume quota.

**FR-AIA-19 --- Should.** The most recent plan must be retained for 30 days and be
re-viewable at no quota cost.

### Quota and cost control

**FR-AIA-20 --- Must.** Default quota is three successful generations per calendar month
per user.

**FR-AIA-21 --- Must.** Quota must be enforced server-side against the authenticated user.

**FR-AIA-22 --- Must.** Quota must be configurable per user and per cohort without an
application release.

**FR-AIA-23 --- Must.** Exhausted quota must return a distinct, non-error state carrying
the reset date, and must be presented as an expected condition rather than a failure.

**FR-AIA-24 --- Must.** A global daily spend ceiling must halt generation and alert
operations.

**FR-AIA-25 --- Must.** A per-user rate limit of one in-flight generation and five per
hour must apply independently of the monthly quota.

### Commit to schedule

**FR-AIA-26 --- Must.** The *Sync* action must write the plan into `workout`,
`workout_group`, and `workout_exercise` within a single database transaction.

**FR-AIA-27 --- Must.** The user must choose **replace** or **append** for the target date
range. The system must never silently overwrite an existing schedule.

**FR-AIA-28 --- Must.** Replace must affect only workouts with `status = 'planned'`.
Workouts that are `in_progress`, `completed`, or `cancelled` must never be modified. This
requirement protects the user's training history, which is the most valuable data in the
application and is irreplaceable.

**FR-AIA-29 --- Must.** Committed rows must enqueue through the sync queue. No
new sync path may be introduced.

**FR-AIA-30 --- Must.** The commit must be undoable for 24 hours, restoring the previous
schedule exactly.

**FR-AIA-31 --- Must.** Plan exercises must resolve to existing catalogue rows. The client
must never create an exercise from model output.

**FR-AIA-32 --- Must.** Where a referenced exercise is absent locally, the client must
fetch it before committing or fail the commit atomically. A partially committed plan is
not an acceptable outcome.

**FR-AIA-33 --- Should.** Committed workouts must record their originating `ai_plan.id`
for traceability.

## Content Management System

**FR-CMS-1 --- Must.** Editors must be able to create, edit, archive, and search exercises
and foods.

**FR-CMS-2 --- Must.** Each food must record name, serving size and unit, energy, protein,
carbohydrate, fat, and fibre.

**FR-CMS-3 --- Must.** Each food must record dietary flags covering at minimum vegetarian,
vegan, halal, gluten-free, dairy-free, and nut-free.

**FR-CMS-4 --- Must.** Each exercise must record `indicatedFor` and `contraindicatedFor`
relations against the controlled condition vocabulary.

**FR-CMS-5 --- Must.** The condition vocabulary must itself be CMS-managed. Editors must
not be able to enter free-text conditions, because free text cannot be filtered on
reliably and would silently defeat FR-AIA-6.

**FR-CMS-6 --- Must.** Content must follow a `draft -> in_review -> published` lifecycle.
Only `published` content may reach generation.

**FR-CMS-7 --- Must.** Publication of safety-relevant metadata must require a second,
distinct approver.

**FR-CMS-8 --- Must.** All changes must be audit-logged with actor, timestamp, and a
before/after difference.

**FR-CMS-9 --- Should.** Editors should be able to preview the population a rule would
affect before publishing it.

**FR-CMS-10 --- Should.** Bulk CSV import must be supported, with per-row validation and a
dry-run mode.

**FR-CMS-11 --- Must.** The CMS must be accessible only to authenticated staff, with roles
distinguishing editor, reviewer, and administrator.

\newpage

# External Interface Requirements

## User interfaces

**FR-UI-1 --- Must.** Navigation is tab-based: Home, Exercises, Results, and
Settings, with modal and stack presentation for detail and editor screens.

**FR-UI-2 --- Must.** The interface must support light and dark themes and
respect the system setting when configured to do so.

**FR-UI-3 --- Must.** The interface must render correctly edge-to-edge and
respect safe-area insets, including devices with a Dynamic Island.

**FR-UI-4 --- Must.** The AI entry point must be discoverable from Home without
displacing the primary workout action.

**FR-UI-5 --- Must.** Plan preview must clearly distinguish proposed content from
committed content, so that a user is never uncertain whether their schedule has changed.

## Hardware interfaces

| Interface | Requirement |
| :--- | :--- |
| Apple Watch | WatchConnectivity session for bidirectional workout control |
| Haptic engine | Rest and set feedback, subject to the user's haptics setting |
| Audio | Rest-completion tones, subject to the volume setting and silent-switch behaviour |

## Software interfaces

### Sync provider

Defined normatively in R2. Summarised here for completeness.

| Endpoint | Purpose |
| :--- | :--- |
| `POST /auth/token` | Exchange local user ID and device ID for a bearer token and expiry |
| `POST /sync` | Push pending local changes, grouped by table name into `created`, `updated`, `deleted` |
| `GET /sync` | Pull changes after the stored cursor; scope `all`, `user`, or `fitup` |

All requests carry `x-fitup-sync-schema: 2` and `Authorization: Bearer <token>`.

### AI service

`POST /v1/plan/generate` --- authenticated, bearer token.

```json
{
  "intent": "bulk",
  "note": "training around lower back pain",
  "profileVersion": "sha256:...",
  "horizonDays": 7
}
```

| Status | Meaning | Body |
| :--- | :--- | :--- |
| `200` | Plan generated and validated | `planId`, `plan`, `quotaRemaining`, `quotaResetsAt` |
| `429` | Quota exhausted --- an expected state, not an error | `quotaRemaining`, `quotaResetsAt` |
| `422` | No valid plan could be produced | `detail`, `quotaConsumed: false` |
| `503` | Model provider unavailable | `retryAfter` |

Supporting endpoints:

| Endpoint | Purpose |
| :--- | :--- |
| `GET /v1/plan/quota` | Quota state without generating |
| `GET /v1/plan/{planId}` | Re-fetch a retained plan |
| `GET /v1/catalogue/sync` | Incremental catalogue pull |

### Plan output contract

```json
{
  "planId": "string",
  "horizonDays": 7,
  "rationale": "string",
  "days": [{
    "dayIndex": 0,
    "workout": {
      "name": "string",
      "exercises": [{
        "exerciseId": "string",
        "sets": 3,
        "reps": 10,
        "restSeconds": 90,
        "rationale": "string"
      }]
    },
    "meals": [{
      "slot": "breakfast",
      "items": [{ "foodId": "string", "servings": 1.5 }]
    }],
    "targets": { "kcal": 2600, "proteinG": 180, "carbsG": 300, "fatG": 70 }
  }]
}
```

**FR-INT-1 --- Must.** `exerciseId` and `foodId` are references into the supplied candidate
set. The model must not emit names, macronutrient values, or instructions; these are
joined from the database at render time.

This constraint eliminates an entire class of failure. The model cannot hallucinate a
food's energy content, because it never writes one.

## Communication interfaces

**NFR-COM-1 --- Must.** All network communication must use TLS 1.2 or later.

**NFR-COM-2 --- Must.** Certificate validation must not be disabled in any build
configuration, including development builds.

**NFR-COM-3 --- Must.** Requests must time out and fail gracefully without blocking the
user interface.

\newpage

# Non-Functional Requirements

## Performance

| ID | Requirement |
| :--- | :--- |
| NFR-PER-1 | Cold start to interactive must not exceed 2.5 s on a mid-tier device. |
| NFR-PER-2 | Set logging must commit and reflect in the interface within 100 ms. |
| NFR-PER-3 | Exercise list scrolling must sustain 60 fps at 1,000 catalogue entries. |
| NFR-PER-4 | AI generation must complete within 12 s at the 95th percentile. |
| NFR-PER-5 | Plan commit must complete within 500 ms for a seven-day plan. |
| NFR-PER-6 | Migrations must complete within 3 s on the largest supported database. |

## Security

| ID | Requirement |
| :--- | :--- |
| NFR-SEC-1 | LLM provider credentials must exist only in the AI service environment --- never in the client, repository, or CMS. |
| NFR-SEC-2 | Bearer tokens must be stored in MMKV and must never be written to logs or analytics. |
| NFR-SEC-3 | The AI service must be stateless; all state resides in PostgreSQL or the quota ledger. |
| NFR-SEC-4 | All AI service inputs must be validated against a schema before use. |
| NFR-SEC-5 | The free-text intent note must be treated as untrusted input and must not be able to alter system-prompt behaviour. |
| NFR-SEC-6 | CMS access must require authentication with role-based authorisation and must be audit-logged. |
| NFR-SEC-7 | Secrets must be held in a managed secret store and injected at runtime, never baked into container images. |

NFR-SEC-5 deserves emphasis. The free-text note is user-controlled text placed into a
model prompt --- a prompt-injection surface. A user could attempt to instruct the model to
disregard its constraints. The architecture contains this risk: because
contraindicated items are filtered in SQL before the model is invoked (FR-AIA-6) and the
validator re-checks the output (FR-AIA-9), a successful injection cannot cause an
excluded item to be recommended. This is the practical benefit of not relying on the
prompt for safety.

## Privacy and data protection

| ID | Requirement |
| :--- | :--- |
| NFR-PRV-1 | Health and condition data must be encrypted at rest. |
| NFR-PRV-2 | Condition, allergen, and health data must never be included in analytics events. |
| NFR-PRV-3 | Data transmitted to the model provider must be governed by an explicit allow-list of fields, never a deny-list. |
| NFR-PRV-4 | Users must be able to delete their profile and generation history; deletion must propagate within 30 days. |
| NFR-PRV-5 | Users must be able to export their data in a machine-readable format. |
| NFR-PRV-6 | Analytics must remain disabled unless explicitly configured, and must be disabled by default in development and preview builds. |
| NFR-PRV-7 | The model provider must be contractually bound to zero retention and no training on submitted data. |

NFR-PRV-3 is a deliberate design choice. An allow-list fails closed: a newly added
profile field is excluded from transmission until someone consciously adds it. A
deny-list fails open, silently transmitting every field added thereafter.

## Reliability and availability

| ID | Requirement |
| :--- | :--- |
| NFR-REL-1 | Core workout functionality must be fully available offline. |
| NFR-REL-2 | AI service unavailability must not degrade any other feature. |
| NFR-REL-3 | Sync failures must be retried with exponential backoff and must never lose queued operations. |
| NFR-REL-4 | Interrupted migrations must not corrupt the database; a failed migration must leave the previous schema intact. |
| NFR-REL-5 | The AI service must target 99.5% monthly availability. |
| NFR-REL-6 | Model provider outage must surface as a distinct, retryable state and must not consume quota. |

## Usability and accessibility

| ID | Requirement |
| :--- | :--- |
| NFR-USA-1 | Interactive targets must be at least 44 x 44 points. |
| NFR-USA-2 | Text must respect the platform dynamic-type setting. |
| NFR-USA-3 | Text contrast must meet WCAG 2.1 AA in both themes. |
| NFR-USA-4 | All interactive elements must carry accessibility labels. |
| NFR-USA-5 | Destructive actions must require confirmation and must be reversible where technically feasible. |
| NFR-USA-6 | AI-generated content must be visually distinguishable from user-authored content. |

## Maintainability

| ID | Requirement |
| :--- | :--- |
| NFR-MNT-1 | `bun run verify` --- lint, typecheck, and tests --- must pass on every commit. |
| NFR-MNT-2 | Product writes must remain confined to `src/crud/`. |
| NFR-MNT-3 | Schema changes must ship as generated Drizzle migrations; hand-edited migrations are prohibited. |
| NFR-MNT-4 | Prompt and few-shot artefacts must be versioned and independently rollback-able from application releases. |
| NFR-MNT-5 | Text files must use LF endings, enforced by `.gitattributes`, because the formatter is configured for LF. |

## Observability

| ID | Requirement |
| :--- | :--- |
| NFR-OBS-1 | Every generation must be logged with input hash, model identifier, prompt version, token counts, cost, validator outcome, and latency. |
| NFR-OBS-2 | Validator rejections must be logged at item and rule granularity. |
| NFR-OBS-3 | Cost per generation and aggregate daily spend must be dashboarded. |
| NFR-OBS-4 | Alerts must fire on daily spend ceiling, validator rejection rate, 95th-percentile latency, and error rate. |
| NFR-OBS-5 | Logs must never contain personal health data. |

\newpage

# Compliance, Legal, and Store Policy

The AI Assistant materially changes Fitup's regulatory and store-review posture. These
requirements are launch blockers, not follow-up work.

## Medical positioning

| ID | Requirement |
| :--- | :--- |
| FR-CMP-1 | A persistent disclaimer must state that plans are general fitness guidance and not medical advice. It must be presented before first generation and must not be dismissible on first view. |
| FR-CMP-2 | The application must make no diagnostic, treatment, or curative claim. Condition data is used solely to *exclude* content, never to *address* a condition. |
| FR-CMP-3 | Users with a declared condition must be advised to consult a qualified professional before beginning. |
| FR-CMP-4 | Interface and store copy must avoid "treats", "heals", "fixes", "cures", "therapy", and "rehabilitation". |

The distinction in FR-CMP-2 is the one on which the product's regulatory position rests.
A system that *excludes* a squat from a plan because the user declared a lumbar condition
is applying a safety filter. A system that *prescribes* an exercise to *treat* that
condition is making a medical claim and would attract regulatory obligations the product
is not built to satisfy. Every piece of copy must respect this line.

## Store policy

| ID | Requirement |
| :--- | :--- |
| FR-CMP-5 | The privacy policy must disclose transmission of profile data to a named third-party model provider, and state the retention period. |
| FR-CMP-6 | HealthKit and Health Connect data must not be transmitted to the model provider without separate explicit consent. Apple guideline 5.1.1(i) prohibits use of health data for advertising or sale; Health Connect restricts onward transmission. |
| FR-CMP-7 | Use of AI must be disclosed on both store listings. |
| FR-CMP-8 | Provider terms including zero retention and no training must be contracted before launch. |
| FR-CMP-9 | User-generated free-text must not be publishable to other users, avoiding user-generated-content moderation obligations. |

## Data protection

| ID | Requirement |
| :--- | :--- |
| FR-CMP-10 | Health and condition data constitutes special-category data under GDPR Article 9. Processing requires explicit consent, obtained separately from general terms acceptance. |
| FR-CMP-11 | Users must be able to exercise access, rectification, erasure, and portability rights in-application. |
| FR-CMP-12 | A record of processing activities must be maintained covering the model provider as a processor. |
| FR-CMP-13 | A Data Protection Impact Assessment must be completed before EU launch, since the feature involves automated processing of special-category data. |

## Licensing

The Fitup client is licensed under GPL-3.0 (R9), and is a rebranded derivative of the
Skulpt workout tracker distributed under the same licence.

| ID | Requirement |
| :--- | :--- |
| FR-CMP-14 | Client modifications for this module are derivative works and must remain GPL-3.0 and be published. |
| FR-CMP-15 | The full licence text and attribution must be retained in the repository and reproduced in-application. |
| FR-CMP-16 | The separability of the CMS and AI service as independent works communicating over a network must be confirmed with counsel before any part of the stack is treated as proprietary. |

FR-CMP-16 is not a formality. The conventional reading is that a separate program
communicating with a GPL program over a network interface is not thereby derivative, but
the analysis is fact-specific and turns on the degree of integration. It should be
settled before commercial commitments depend on the answer.

\newpage

# Infrastructure and Deployment

## Load characteristics

Sizing follows from actual expected load rather than from headroom estimates.

At 10,000 monthly active users generating three plans each, the system serves
approximately **30,000 generations per month**, or roughly 1,000 per day. Concentrated
into peak evening hours, this is approximately **two to five concurrent requests**. Each
request spends nearly all of its wall-clock time awaiting the model provider, not
computing.

## Platform options

| Option | Approximate monthly cost | Assessment |
| :--- | ---: | :--- |
| ECS Fargate, 2 x 0.5 vCPU | ~$25 | **Recommended.** No hosts to patch; scales down cleanly. |
| Single EC2 `t4g.small` with Compose | ~$12 | Acceptable and cheapest. Patching and restarts become your responsibility. |
| EKS | ~$73 control plane, plus nodes; ~$150+ | **Not recommended at this scale.** |

The brief raises EC2 with Docker, or EKS. At five concurrent requests, **the EKS control
plane alone would cost more than the model usage it orchestrates.** Kubernetes earns its
operational overhead when many services are run by a team with established
practice; it should be adopted at that point, not for a single stateless endpoint.

PostgreSQL should be RDS rather than self-managed. Automated backups and point-in-time
recovery are worth more than the saving, particularly for the catalogue, which represents
substantial irreplaceable human curation effort.

## Deployment requirements

| ID | Requirement |
| :--- | :--- |
| NFR-DEP-1 | The service must be containerised, with images built in CI and tagged by commit. |
| NFR-DEP-2 | Secrets must be held in AWS Secrets Manager and injected at runtime. |
| NFR-DEP-3 | Deployments must be rolling or blue/green, with prompt versions pinned per deployment. |
| NFR-DEP-4 | Structured JSON logs must ship to CloudWatch with cost and validator metrics. |
| NFR-DEP-5 | Database migrations must run as a separate, explicitly triggered step, not on service start. |
| NFR-DEP-6 | The catalogue must be backed up daily with a tested restore procedure. |

## Client release

| ID | Requirement |
| :--- | :--- |
| NFR-DEP-7 | Client builds ship through EAS with development, preview, and production profiles. |
| NFR-DEP-8 | JavaScript-only changes may ship as over-the-air updates; native module changes require a store submission. |
| NFR-DEP-9 | Source maps must upload to Sentry on every production build. |
| NFR-DEP-10 | Runtime version policy follows `appVersion`, so an OTA update can never target an incompatible native binary. |

\newpage

# Verification and Acceptance

## Verification approach

Automated test coverage shall be maintained for sync flow, catalogue forking, analytics,
authentication, health statistics, notification chains, exercise search, and plan
generation. A single verification command shall run linting, type checking, and the full
suite, and shall pass before any change is merged (NFR-MNT-1).

Safety-critical behaviour --- the constraint filtering in 5.13.4 and the validation in
5.13.5 --- shall additionally be covered by the adversarial suite described in AC-1, which
is maintained independently of the unit suite and treated as a release gate.

## Acceptance criteria

| ID | Criterion | Method |
| :--- | :--- | :--- |
| AC-1 | Across a 200-case adversarial suite, **zero** plans reaching a user contain a contraindicated or allergen-violating item. | Automated suite |
| AC-2 | At least 95% of generations return a schema-valid plan on first attempt. | Staged measurement |
| AC-3 | At least 90% pass the validator without repair. | Staged measurement |
| AC-4 | Quota cannot be exceeded by a modified client. | Direct API testing with tampered client and token |
| AC-5 | Commit never modifies a workout that is not `planned`. | Transaction test |
| AC-6 | Undo restores the previous schedule exactly. | Automated test |
| AC-7 | 95th-percentile latency at or below 12 s under 50 concurrent generations. | Load test |
| AC-8 | The application remains fully functional with the AI service unreachable. | Manual and automated, network disabled |
| AC-9 | No health or condition data appears in any analytics payload. | Network capture inspection |
| AC-10 | A prompt-injection attempt in the free-text note cannot cause an excluded item to be recommended. | Adversarial suite |

**AC-1 must be built before implementation begins, not after.** It is the only mechanism
that converts the guarantee described in 5.13.1.4 from an intention into a verified
property. A suite written after the fact tends to encode the behaviour that was built
rather than the behaviour that was required.

\newpage

# Risks

| ID | Risk | Severity | Mitigation |
| :--- | :--- | :--- | :--- |
| R-1 | A contraindicated exercise is recommended and a user is injured. | Critical | SQL-level filtering (FR-AIA-6), deterministic validation (FR-AIA-9), AC-1 suite, qualified rule ownership (Q4) |
| R-2 | Store rejection on medical-claim grounds. | High | Section 8 complete before submission; pre-submission legal review |
| R-3 | Catalogue metadata is thin, so filtering under-blocks. | High | Phase 1 content gate; every rejection logged to locate gaps (FR-AIA-12) |
| R-4 | Cost overrun through abuse. | Medium | Server-side quota, rate limits, global ceiling (FR-AIA-24) |
| R-5 | Model provider outage. | Medium | Graceful degradation (NFR-REL-2), quota preserved, secondary provider evaluated |
| R-6 | Prompt regression silently degrades quality. | Medium | Versioned prompts, acceptance suite in CI on every prompt change |
| R-7 | Health data reaches the provider without consent. | High | Allow-list transmission (NFR-PRV-3), FR-CMP-6, AC-9 |
| R-8 | Users treat plans as medical advice. | High | Section 8.1 copy discipline, disclaimers, professional-consultation prompts |
| R-9 | Nutrition scope doubles Phase 0 and delays launch. | Medium | Consider training-only first release (Q3) |
| R-10 | GPL obligations conflict with commercial intent for the service tier. | Medium | Resolve FR-CMP-16 with counsel before commercial commitments |

R-1 is the risk that governs the architecture of this module. Every design decision in
5.13 --- filtering before generation rather than instructing during it, validating after
generation, rejecting rather than repairing safety violations, and requiring a named
clinical owner --- exists to reduce it. The controls are defence in depth precisely
because no single one of them is sufficient.

\newpage

# Phasing

| Phase | Contents | Exit gate |
| :--- | :--- | :--- |
| **0** | Nutrition schema, profile schema, condition vocabulary, onboarding flow | Section 4.2 gaps closed; onboarding shipped and skippable |
| **1** | CMS with lifecycle, roles, and audit; content team loads catalogue | At least 500 foods and 300 exercises published with conditional metadata, reviewer-approved |
| **2** | AI service: retrieval, generation, validator, quota. No client UI. | AC-1 through AC-4 and AC-10 pass against the service directly |
| **3** | Client flow: entry point, intent capture, preview, commit, undo | AC-5, AC-6, AC-8 pass |
| **4** | Compliance copy, privacy policy, store disclosures, provider terms, DPIA | Section 8 complete; legal sign-off |
| **5** | Staged rollout 5% to 25% to 100%, monitoring cost and rejection rate | AC-7 holds in production; no AC-1 violations observed |

Phase 0 is on the critical path and is substantially larger than it appears from the
brief. It comprises a complete onboarding flow plus an entire domain --- nutrition ---
that the core product does not model in any form. Estimating this phase from the
AI feature description alone will underestimate it considerably.

Phase 2 deliberately precedes any client work. Building the service first, and proving
its safety properties against the acceptance suite before a single screen exists, means
the safety-critical component is validated in isolation rather than through the interface.

\newpage

# Open Decisions

These require resolution before Phase 2. Each materially changes implementation.

| # | Question | Consequence |
| :--- | :--- | :--- |
| **Q1** | Is quota three per month universally, or does a paid tier receive more? | Determines whether billing, receipt validation, and subscription management enter v1 scope |
| **Q2** | What is the plan horizon --- one day, seven days, or twenty-eight? | Drives token budget, cost per generation, and validator complexity |
| **Q3** | Does v1 cover nutrition and training together, or training only? | Nutrition roughly doubles Phase 0; training-only is a materially faster path to launch |
| **Q4** | Who signs off that a contraindication rule is clinically sound? | Currently unassigned; highest-severity open item in this document |
| **Q5** | Which markets at launch? | EU launch triggers GDPR Article 9 obligations and a DPIA (FR-CMP-13) |
| **Q6** | Is the CMS a bespoke build or an off-the-shelf headless CMS with a custom schema? | Approximately six weeks of schedule difference |
| **Q7** | Is the exercise media bucket and sync provider infrastructure owned and provisioned? | Exercise media hosting and a sync provider must both be provisioned before launch |

## A note on Q4

Every control specified in 5.13.5 assumes that the catalogue's contraindication data is
correct. The system will enforce those rules faithfully and verifiably. It cannot
determine whether the rules themselves are clinically sound.

That judgement requires a qualified human owner with named accountability. The
originating brief does not identify one. Until it does, the safety architecture described
in this document is structurally complete but resting on an unvalidated foundation, and
R-1 is not genuinely mitigated regardless of how well the software behaves.

\newpage

# Appendix A --- Requirement Summary

| Area | Prefix | Count | Section |
| :--- | :--- | ---: | :--- |
| Architecture | FR-ARC | 2 | 3.2 |
| Identity and accounts | FR-IDN | 4 | 5.1 |
| Profile and onboarding | FR-PRO | 9 | 5.2 |
| Exercise catalogue | FR-EXC | 6 | 5.3 |
| Workout planning | FR-WKP | 5 | 5.4 |
| Workout execution | FR-WKE | 8 | 5.5 |
| Body measurements | FR-MEA | 4 | 5.6 |
| Results and analysis | FR-RES | 4 | 5.7 |
| Health integration | FR-HLT | 5 | 5.8 |
| Watch and Live Activity | FR-WAT | 4 | 5.9 |
| Notifications | FR-NOT | 3 | 5.10 |
| Settings and localisation | FR-SET | 6 | 5.11 |
| Synchronisation | FR-SYN | 6 | 5.12 |
| AI Training Assistant | FR-AIA | 33 | 5.13 |
| Content Management System | FR-CMS | 11 | 5.14 |
| Data | FR-DAT | 3 | 4.3 |
| Interfaces | FR-INT, FR-UI | 6 | 6.1, 6.3 |
| Compliance | FR-CMP | 16 | 8 |
| Non-functional | NFR-* | 46 | 7, 9 |

Approximate totals: **135 functional requirements** and **46 non-functional
requirements**.

The AI Training Assistant accounts for 33 functional requirements directly, and is the
originating cause of a further 39 across the profile, data, CMS, and compliance areas.
Estimating the module from Section 5.13 alone will therefore understate it by roughly a
factor of two.

# Appendix B --- Traceability

| Risk | Mitigating requirements | Verifying criteria |
| :--- | :--- | :--- |
| R-1 Injury from contraindicated content | FR-AIA-6, FR-AIA-9, FR-AIA-10, FR-AIA-12, FR-CMS-4, FR-CMS-5, FR-CMS-7 | AC-1, AC-10 |
| R-2 Store rejection | FR-CMP-1 to FR-CMP-9 | Section 8 review |
| R-3 Thin catalogue metadata | FR-CMS-4, FR-CMS-6, FR-CMS-9, FR-AIA-12 | Phase 1 gate |
| R-4 Cost overrun | FR-AIA-20 to FR-AIA-25 | AC-4 |
| R-5 Provider outage | NFR-REL-2, NFR-REL-6, FR-AIA-11 | AC-8 |
| R-6 Prompt regression | FR-AIA-3, FR-AIA-4, NFR-MNT-4 | AC-2, AC-3 |
| R-7 Health data leakage | NFR-PRV-2, NFR-PRV-3, FR-CMP-6, FR-HLT-5 | AC-9 |
| R-8 Plans read as medical advice | FR-CMP-1 to FR-CMP-4, NFR-USA-6 | Section 8 review |

# Appendix C --- Document Control

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-08-07 | Engineering | Initial complete specification, covering the shipped application and the AI Training Assistant module |

**Status: Draft.** Sign-off is blocked on the open decisions in Section 13, of which Q4
is the highest severity.
