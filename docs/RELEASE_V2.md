# FitSyn v2: release checklist

What the redesign branch (`redesign/v2`) changed, what it did **not** do, and what a
human has to do before a store build. Server pieces are written as files; nothing
here was applied, deployed or built.

## 1. Native rebuild required

These changes need a new native build (an OTA update is not enough):

- Fonts: `BarlowCondensed-SemiBold.ttf` (OFL, licence beside it) via the `expo-font` plugin.
- New modules: `expo-apple-authentication` (plus the `usesAppleSignIn` entitlement),
  `expo-crypto`, `expo-image-picker`.
- New tab layout (`(you)` group), new routes (`/welcome`, `/inbox`, `/settings/feedback`).
- Splash background colours.

## 2. Server work (review, then apply)

| File | What it does | Apply with |
|---|---|---|
| `supabase/migrations/0010_feedback.sql` | `feedback` table (insert-only RLS) and a private `feedback-screenshots` bucket | `supabase db push` |
| `supabase/migrations/0011_ai_usage.sql` | `ai_usage` table and `ai_consume()` (monthly plan quota + per-minute rate limit), service-role only | `supabase db push` |
| `supabase/migrations/0012_ai_usage_report.sql` | `ai_consume()` also returns `plan_count` and `month`; new `ai_refund(user, month)` gives one build back (never below 0). Service-role only. Apply after 0011 | `supabase db push` |
| `supabase/functions/syn-complete` | AI proxy: verifies the JWT, holds the provider key, enforces quota. Adds `X-Syn-Builds-Remaining` / `X-Syn-Builds-Reset` (next UTC month start) to every answer after the usage check, and refunds a plan build whose upstream call fails (non-2xx or error envelope, empty or `finish_reason: "length"` reply, timeout, app hung up). Response body unchanged. Deploy after 0012 (before it, the headers are just left off) | `supabase functions deploy syn-complete` |
| `supabase/functions/delete-account` | Deletes the caller's backup rows, screenshots and auth user | `supabase functions deploy delete-account` |

Secrets for `syn-complete`: `AI_API_KEY`, `AI_BASE_URL`, optionally
`AI_COMPLETIONS_PATH`, `AI_MONTHLY_PLAN_LIMIT` (default 3),
`AI_RATE_LIMIT_PER_MINUTE` (default 10), `AI_ALLOWED_MODELS`.

Both functions keep the platform's default JWT verification (no `config.toml` entry).

## 3. Build configuration

Production builds must use the proxy and carry **no** provider key:

```
EXPO_PUBLIC_AI_TRANSPORT=proxy
EXPO_PUBLIC_AI_BASE_URL=https://<project-ref>.supabase.co/functions/v1
EXPO_PUBLIC_AI_COMPLETIONS_PATH=/syn-complete
# EXPO_PUBLIC_AI_API_KEY must be unset
```

`app.config.js` throws if `APP_VARIANT` / `EAS_BUILD_PROFILE` is `production` and a key
is present or the transport is `direct`. Note: a local `.env.local` that holds
`EXPO_PUBLIC_AI_API_KEY` will trip this on a local production build, which is the point.

Keep the on-device quota (`EXPO_PUBLIC_AI_MONTHLY_QUOTA`) equal to
`AI_MONTHLY_PLAN_LIMIT`: it is the "of N" the app shows. The remaining count comes from
the server's headers once a request has answered this session; the device count of saved
plans is only the fallback before that.

## 4. Sign in with Apple

1. Apple Developer: the App ID needs the Sign in with Apple capability (the config
   plugin adds the entitlement).
2. Supabase dashboard: Authentication, Providers, Apple. Enable it and add the iOS bundle
   id as an authorised client id. The native flow needs no Services ID or secret key.
3. `EXPO_PUBLIC_AUTH_APPLE_ENABLED=false` hides the button if you need to ship without it.

## 5. Store consoles (humans)

- **Account deletion URL** (Google Play): publish a public page that explains how to
  request deletion (the in-app flow is Settings, You, Account, Delete account). Not
  built here.
- **App Store privacy labels / Play Data safety**: declare account identifiers (email,
  Apple/Google id), health and fitness data (workouts, body measurements, HealthKit /
  Health Connect reads and writes), user content (feedback text and optional screenshot),
  diagnostics (Sentry, PostHog), and that training history, profile and plan context are
  sent to the AI provider when Syn is used.
- **Privacy policy**: describe that AI data flow and the retention of `feedback` rows;
  list the AI provider as a processor.
- **Screenshots**: Welcome, Today, Plan (Week and Library), Coach (empty and a proposal),
  Preview changes, active workout and rest ring, Progress, Feedback.
- **Hero photography**: replace the placeholder
  `assets/images/placeholders/hero-gym.jpg` (used on Welcome, Today's hero, Plan preview,
  the session hero). Needed: one dark gym image at 1200 x 675 (16:9), safe to crop to a
  card and to full-bleed portrait 1170 x 2532 for Welcome. Licensed for app use.
- **Licence**: the repo is GPL-3.0. Confirm that is intended for the product.

## 6. Decisions taken

- "Get stronger" saves `gain`, like "Build muscle". Dark is not the default theme (the app
  still follows the system). Feedback goes to a Supabase table with a mail fallback. The
  notification log is a local table (Drizzle `0030`), not backed up.
- Food charts under **1200 kcal/day** are rejected (`MIN_DAILY_CALORIES`).
- A session a plan replaces or removes is set to `cancelled`, recorded in the plan row's
  `appliedWorkoutIds` as `~<id>`, and restored by Undo. A dedicated column would be
  cleaner but needs a local and a backup migration.

## 7. Not done, or only partly

- Per-phase checkpoints and new tests were skipped on purpose (standing instruction: one
  preview build at the end). Existing tests were updated where behaviour changed.
- **Device-only checks**: Live Activity, Apple Watch, HealthKit / Health Connect, push and
  local notifications (including the new log), offline workout flow, the stale-workout
  prompt, the missed-session sheet, the Syn preview sheet on both platforms, Sign in with
  Apple, account deletion on a throwaway account.
- **Largest Dynamic Type / font scale** and light/dark pass over every screen: not run.
- iOS floating tab bar inset: scroll views already inset through
  `contentInsetAdjustmentBehavior`, so the old 32pt padding was left; the Results muscle
  map overlap needs a device look.
- Translations: only English was written. `hi` falls back to English for the new keys.
  There is no es / ru / zh locale in this repo; `bun run locale` only bundles en and hi.
- Plan Library: minor muscles are not folded under their parent group in the list.
- Workout complete: the PR badge and muscle map were not added to the finish screen
  (personal bests and the muscle map are on Progress; difficulty is still the sheet).
- Exercise detail got the new tokens only.
- Create Account has no Name field; the name is asked in onboarding.
- Home no longer shows the AI plan cards; plan building lives on Coach.
