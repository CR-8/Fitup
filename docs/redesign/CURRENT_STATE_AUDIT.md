# Current state audit

Branch `redesign/v2` at `30e553f`, audited 2026-10-16. This branch already carries a
first v2 redesign (21 commits ahead of `main`: tokens, new IA, Today/Plan/Coach/Progress/You,
onboarding, workout player polish; see `docs/RELEASE_V2.md`). This audit is of that code,
read file by file, not inferred from screen names.

Baseline before any change in this pass: `bun run typecheck` (iOS and Android programs)
**passes**; `bun run test:ci` **47 suites passed, 1 skipped, 538 tests passed**.
Uncommitted user work present and left alone: `src/components/forms/fields/datetime/index.tsx`,
`src/screens/settings/settings/index.tsx` (modified), `src/components/overlays/menu/index.tsx`,
`src/screens/auth/sign-in/index.test.tsx`, `src/services/account.live.test.ts` (untracked).

## 1. Platform and build

| Item | Value |
|---|---|
| Expo SDK | 57 (`expo ^57.0.26`), Expo Router 57, `newArchEnabled: true` |
| React Native / React | 0.86.3 / 19.2.3 |
| "Custom compiler" | React Compiler (`experiments.reactCompiler: true`, `babel-plugin-react-compiler`) + Unistyles 3 Babel plugin (root `src/routes`) + Worklets plugin + `inline-import` for `.sql`. Metro blocks `cms/`, `cms-payload/`, `supabase/functions/`. |
| Platform split | **Already in place**: iOS renders native SwiftUI controls through `@expo/ui` (buttons, segmented, switches, settings rows), native tabs (`NativeTabs`, Liquid Glass) and native stack bars. Android renders the "pre-native" JS UI from `*.android.tsx` siblings (custom tab bar `overlays/menu`, in-page headers, Lucide icons, DM Sans / Space Grotesk fonts, `@gorhom/bottom-sheet` sheets, Reanimated press scale). |
| Type checking | Two programs: `tsconfig.json` (iOS, excludes `*.android.*`) and `tsconfig.android.json` (`moduleSuffixes: [".android", ""]`). Both run in `bun run typecheck`. |
| Builds | EAS (`eas.json`: development, preview, production). `bun run ios` / `android` for local native builds. No native build can be run from this Windows checkout for iOS; none was run here. |
| Native modules / plugins | Live Activity (`modules/live-activity`, `targets/workout-widget`), Watch (`targets/watch`, `modules/watch-connectivity`), HealthKit (`@kingstinct/react-native-healthkit`), Health Connect, Sign in with Apple, `plugins/with-fabric-mount-props-flag`, Sentry. |

## 2. Libraries already installed (no installs needed this pass)

Reanimated 4.5.1 + Worklets 0.10.1, Gesture Handler 2.32, React Native SVG 15.15, `@gorhom/bottom-sheet` 5 (Android sheets), `@expo/ui` (iOS), Expo Haptics, Expo Linear Gradient, `expo-symbols` (iOS icons) + `lucide-react-native` (Android icons), `react-native-gifted-charts` (the one chart library: Progress, exercise stats), React Hook Form + Zod 4 + `@hookform/resolvers`, TanStack Query 5, Zustand 5, MMKV 4, Drizzle ORM on `expo-sqlite`, i18next. **Not installed and not needed**: Skia, Victory, Expo Blur.

## 3. Architecture and state

- **Local-first**: SQLite (Drizzle) is the product database; migrations in `drizzle/` run at start (`src/routes/_layout.tsx`). Writes go through `src/crud/*`, which also append to `sync_queue` for the optional Supabase account backup (`src/services/backup`, table map `tables.ts`, guarded by `tables.test.ts`).
- **Server pieces**: Supabase Auth (email, Google, Apple), backup tables, exercise catalogue RPC, `syn-complete` AI proxy with `ai_usage` quota (migration 0011, **not applied** per RELEASE_V2), `delete-account`, push nudge.
- **Query/state**: TanStack Query over CRUD reads; Zustand stores for interaction state (`src/stores`); MMKV for small values.
- **Auth/session restore**: `useAccount` + `Stack.Protected` guard in the root layout; render held until the stored session is read; `useFirstLaunchGate` routes first launch to `/welcome` / `/onboarding`.
- **Deep links**: schemes `fitsyn`, `fitup`; auth callback route; notification paths resolved by `helpers/notification-navigation.ts`.

## 4. Feature status

| Area | Status | Where | Notes |
|---|---|---|---|
| Welcome, sign-in (email, Google, Apple), password reset | exists | `screens/welcome`, `screens/auth/*` | |
| Onboarding: profile (name, age, sex, height, weight, target), goal, schedule; builds and previews a plan | exists | `screens/onboarding` (3 steps + generation + preview) | Diet, allergies, injuries, equipment are **not asked**. Progress not persisted mid-flow. |
| Fitness profile edit | exists | `screens/settings/profile` (shares `onboarding/schema.ts`) | |
| Dietary profile (pattern, allergens) | **missing UI** | columns exist on `ai_profile` (`dietaryPattern`, `allergens`), sent to the model, never editable | No "eggetarian" value. |
| Today dashboard | exists, partial vs brief | `screens/home` | Header (greeting/name/date/bell), Up Next hero, weekly stat tiles, meals checklist, Syn nudge, recent sessions. **No** daily progress summary, hydration, or AI allowance. Whole screen waits on the workouts query (spinner). |
| Weekly plan (Week / Library) | exists | `screens/plan`, `screens/workouts/hub` (+ `week-strip`) | Missed-session sheet, planned vs missed. |
| Workout detail, exercise detail | exists | `screens/workouts/workout`, `screens/exercises/exercise` | |
| Workout player, rest timer (ring, ±15 s), completion feedback | exists | `screens/workouts/timer`, `overlays/rest`, `hooks/use-running-workout.tsx` | Session is a SQLite row (`in_progress`), so it survives background and kill; stale-workout prompt. Live Activity + Watch. |
| Session history | exists | Plan list + workout screen | |
| AI Coach | exists as a chat thread | `screens/syn` | Starter chips build a workout or food plan with a fixed intent; plan arrives as an inline card; **no** hub, **no** generation form, **no** confirmation before spending a build, **no** saved-plans list. |
| Generated plan review + explicit sync | exists | `syn/components/plan-card`, `overlays/merge-preview` (`/preview` sheet), `ai/apply-plan.ts`, `helpers/plan-diff.ts` | Row-by-row diff (new / replaced / removed), applies only after confirming, cancels (not deletes) replaced sessions, Undo restores. Draft / applied / discarded status on `ai_plan`. |
| Meal plan generation (Indian) | exists | `ai/prompt.ts` (North Indian home cooking hard-coded), `crud/nutrition`, `screens/diet` | 3-day food horizon; food synced into `meal`/`meal_item` on apply; ≥1200 kcal guard. Region not selectable. |
| Nutrition day view | exists | `screens/diet` (`/diet` modal) | Consumed vs planned tracked separately. |
| Hydration logging | **missing** | — | No table, hook or UI. (`body_water_mass` is a body-composition measurement, unrelated.) |
| Progress / trends | exists | `screens/results` | Activity summary, sessions per week with goal line, personal bests, strength, scale/weight chart, fitness level. |
| You / settings | exists | `screens/settings/*` | Native settings rows on iOS. |
| Notifications inbox, feedback, account deletion | exists | `screens/inbox`, `settings/feedback`, `services/account-deletion.ts` | |
| Connected data (HealthKit / Health Connect) | exists, partial | `services/health.ts`, `hooks/use-health-importer.ts` | No dedicated status screen. |
| AI quota display | partial | `useAiQuota` in `hooks/use-ai.tsx` | **Counts plans on this device** (`countPlansThisMonth`) and blocks at the local count. Reset date is client-calculated (first of next month). |
| Server quota | exists (not applied) | `supabase/functions/syn-complete`, `migrations/0011_ai_usage.sql` | Counts every JSON request (`response_format: json_object`) per user per **UTC month**; default 3. |
| Subscription / purchase / restore / entitlement | **missing** | — | No billing SDK, no entitlement table, no paid tier on the server. `MONTHLY_PLAN_LIMIT` is one global number. |

## 5. Backend contracts the UI depends on

- `syn-complete` (POST, OpenAI chat-completions body, bearer = Supabase JWT). Refusals: `403 {error:{type:"monthly_quota"}}` → `AiError('USER_QUOTA')`; `429 rate_limit`; `401 auth`. **It does not return remaining builds or a reset date**, and there is no read-only usage endpoint.
- `ai_consume()` counts a plan build **before** the provider call and never refunds. Consequences: a provider failure/timeout after the count still spends a build; the client's truncation retry (`attempt(FALLBACK_HORIZON_DAYS)`) spends a second one; an intake question (`need_info`) spends one. There is no idempotency key.
- Local contracts: `ai_plan.status` (`draft | applied | discarded`), `applyPlanToSchedule(planId, payload, userId, start, rows)`, `revertAppliedPlan`, `meal.date` as local `YYYY-MM-DD`.

## 6. Compatibility risks

1. Two type programs: any new shared import must resolve on both; Android-only files must not leak into the iOS program and vice versa.
2. `@expo/ui` buttons on iOS take a limited prop set (no custom colours); custom-coloured controls must be plain RN views.
3. Theme colours: iOS screens sometimes `Platform.select` a different muted colour; follow the surrounding file.
4. Backup completeness test fails if a new `user` column is not listed in `tables.ts`.
5. Migrations are generated by drizzle-kit and bundled through `drizzle/migrations.js`; hand-edits must keep the journal in step.
6. React Compiler: avoid mutating props/state; it already compiles the whole app.
7. iOS floating tab bar and Android pinned tab bar need different bottom clearance (see `undo-toast`).

## 7. Files likely to change

`unistyles.ts`, `src/theme/icons.ts`, `src/components/primitives/icon/index.android.tsx`, `src/db/schema/*` (+ new migration), `src/services/backup/tables.ts`, `src/crud/*` (new water module), `src/hooks/*` (new water hook), `src/screens/home/*`, `src/screens/syn/*`, `src/ai/prompt.ts` (region wording only), `src/routes/_layout.tsx` + new routes, `src/locale/resources/en/screens.json` (+ bundle).

## 8. Must remain untouched

Supabase functions and migrations; backup push/restore logic; auth flows; `use-running-workout` state machine; Live Activity / Watch / HealthKit modules; `apply-plan.ts` merge semantics; build config (`app.config.js`, `eas.json`, Babel, Metro); the user's uncommitted files listed above.
