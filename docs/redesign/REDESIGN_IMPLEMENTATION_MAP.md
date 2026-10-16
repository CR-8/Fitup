# Redesign implementation map

Grounded in `CURRENT_STATE_AUDIT.md` and `VIDEO_REFERENCE_AUDIT.md`. Most of the brief's
screens already exist on `redesign/v2`; this pass fills the gaps and leaves working
screens alone. P0 = this pass, P1 = next, B = blocked on backend.

Priority / risk key: **P0/P1/B**, regression risk **L/M/H**.

| # | Requirement | Reference | Existing | Planned change | Files | Deps | Acceptance | Pri | Risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Shared card, progress bar, modal header | Summary cards 0:48; sheets 1:24 | Each card restyles `foreground + 2xl radius + border` by hand; modal headers duplicated per screen (`diet/components/header`) | `layout/card` (optional press), `feedback/progress-bar` (a11y progressbar), `layout/modal-header` (`.android` variant: in-page back + title; iOS: native bar title + Done) | `src/components/**` | none | Used by ≥2 new screens; both type programs pass | P0 | L |
| 2 | Hydration + glyphs/colour | Metric colour per value 2:08 | none | `hydration` semantic blue; `droplet`, `sparkles` icons on both icon sets | `unistyles.ts`, `theme/icons.ts`, `icon/index.android.tsx` | none | Same glyph meaning on iOS (SF) and Android (Lucide) | P0 | L |
| 3 | Water log storage | — | none | `water_log` table (local day `YYYY-MM-DD`, ml, time); `user.water_target_ml`, `user.water_glass_ml` (null = default 2000 / 250, labelled as default). Device-local like `notification_log` and meals; new `user` columns listed `deviceOnly` in backup map | `db/schema`, `drizzle/0031_*`, `crud/water`, `services/backup/tables.ts` | drizzle-kit | Migration runs on start; backup completeness test passes | P0 | M |
| 4 | Water hooks: add, undo, target | B03 | none | `use-water.ts`: day query, optimistic add with rollback, undo via existing undo toast, delete entry, settings save | `hooks/use-water.ts` | TanStack Query | Today updates before the write resolves; failure rolls back | P0 | L |
| 5 | B01 hydration card | Step Count card 0:48 | none | Glasses / target, segmented glass pips, "+ Glass" quick add, tap → B03 | `screens/home/components/hydration` | 1–4 | Add, undo, reaches B03 | P0 | L |
| 6 | B03 hydration detail | Activity day detail 1:12, goal stepper 1:24 | none | `/hydration` modal: big value, bar, quick sizes, today's log with remove, undo last, target stepper, glass size, day-boundary + "logged by you" notes | `routes/hydration.tsx`, `screens/hydration` | 1–4 | Target change reflects on Today | P0 | L |
| 7 | B01 order + header + daily summary + allowance | Summary 0:48 | Greeting, Up Next, tiles, meals, nudge, recent; full-screen spinner | Date eyebrow + large "Today" + bell + avatar; **Today summary** card with three labelled bars (training, water, meals — real data only, not rings); order: summary → Up Next → water → meals → week tiles → AI allowance row → nudge → recent; shell renders immediately, Up Next shows a placeholder while workouts load | `screens/home/**` | 1–5 | Card failures independent; no fake values | P0 | M |
| 8 | No active plan → Coach | SCREEN_FLOW §3 | Up Next "create" opens the editor | When AI is available, primary goes to Coach; editor kept as secondary | `home/components/up-next` | — | Local-only builds still reach the editor | P0 | L |
| 9 | D01 Coach hub | Custom Plans 8:52 | Chat empty state with four chips | Empty state becomes the hub: two large choices (workout plan, Indian meal plan) with "uses 1 plan build", allowance row → D08, free "Ask Syn" chips, recent plans → D07. Thread unchanged once a conversation exists; its build chips open the form | `screens/syn/index.tsx`, `syn/components/hub` | 1, 10 | Building never starts from a single tap | P0 | M |
| 10 | D02 / D05 generation form + quota confirmation | Build Your Plan 9:20 | none (fixed intents) | `/coach/new?kind=` modal. Workout: goal, sessions/week, minutes, home/gym, optional focus. Meals: diet (incl. **eggetarian**), allergies (sticky, saved to profile), region (North/South/West/East/Mixed), cooking time, budget. Prefilled from profile; non-profile prefs kept in MMKV across navigation. Bottom CTA shows the build cost and remaining count; disabled when used up → D08. Medical-diet caution line | `routes/coach/new.tsx`, `screens/coach/new`, `db/schema/ai.ts` (enum), `ai/prompt.ts` (region wording) | 1 | Profile prefill; allergies persist; intent carries choices | P0 | M |
| 11 | D07 saved plans | My Plan / "ACTIVE · 1 OF 2" 10:24 | plans only visible inline in the thread | `/coach/plans` list (Active, Drafts, Archived; kind, date) → `/coach/plan/[planId]` showing the existing `PlanCard` (review, Preview changes, Undo) | `routes/coach/*`, `screens/coach/plans`, `crud/ai` (list query) | 1 | Draft vs active clearly labelled | P0 | L |
| 12 | D08 quota screen | — | Alert when local count is 0 | `/quota` modal: remaining of limit, bar, what counts (honest about failed attempts and intake questions), reset policy, what is free, "extra builds not available yet". Linked from Today, hub, form, thread | `routes/quota.tsx`, `screens/quota` | 1 | No paywall on any non-AI route | P0 | L |
| 13 | Server-authoritative remaining + reset date | SCREEN_FLOW §7 | server counts but never reports | `syn-complete` sends `X-Syn-Builds-Remaining` and `X-Syn-Builds-Reset` on every answer after the usage check (0012 makes `ai_consume` return the count). `requestCompletion` records them, from errors too, in `useAiUsageStore`; `useAiQuota` prefers them (same account, before the reset date) and falls back to the device count. D08 shows the reset date and drops the device-count caveat once the server has answered. Written, **not deployed** | `supabase/migrations/0012_ai_usage_report.sql`, `supabase/functions/syn-complete`, `api/ai.ts`, `hooks/use-ai.tsx`, `screens/quota`, `screens.json` | 0012 applied, function deployed | After any Syn request the quota screen matches the server; a fresh launch shows the device count with its caveat until then | P0 | L |
| 14 | No double charge on retry | SCREEN_FLOW §5 | truncation retry and provider failures spend builds | `syn-complete` calls `ai_refund` when a plan build's upstream call fails: non-2xx or error envelope, empty or truncated (`finish_reason: "length"`) reply, provider timeout, or the app hanging up (cancel, client timeout). The truncation retry is therefore charged once. A reply Syn did produce still counts (intake question, unreadable or unsafe plan). No idempotency key: the client never resends the same request. D08 says failed builds are given back once the count is the server's. Written, **not deployed** | `supabase/migrations/0012_ai_usage_report.sql`, `supabase/functions/syn-complete`, `screens/quota` | 0012 applied, function deployed | A truncated first attempt plus a successful retry leaves `plan_count` up by one | P0 | M |
| 15 | Purchase / restore / entitlement | D08 | none | **Blocked**: no billing system or paid tier exists. Not invented. D08 states extra builds are not available | — | billing | — | B | — |
| 16 | Dietary profile in You | E03 | none | P1: `/settings/diet` reusing the form's diet fields | — | 10 | — | P1 | L |
| 17 | Weekly plan, workout detail, player, rest, completion, progress, onboarding | 9:40, 10:32, 8:00 | exist (v2) | No rewrite. Parity items in §Parity | — | — | Existing tests pass | — | — |
| 18 | Onboarding diet/constraints steps (A05/A06), persisted progress | A05–A06 | not asked | P1: add a diet step reusing #10 fields | — | 10 | — | P1 | M |
| 19 | Connected-data status (E04) | — | health import exists, no status screen | P1 | — | — | — | P1 | L |

## Milestones

1. **M1 Foundation** — #1, #2. Check: both type programs.
2. **M2 Hydration** — #3–#6. Check: typecheck, backup completeness test, migration bundle.
3. **M3 Today** — #7, #8.
4. **M4 Coach** — #9–#12 (and #10's prompt wording).
5. **M5 Regression** — `bun run verify` (lint, both typechecks, jest). Device-only checks listed below stay open: no simulator or device is available from this Windows checkout, and the standing instruction is one preview build at the end.

## Free vs paid audit

Only `syn-complete` plan builds are limited. After this pass the limit is surfaced at:
Coach hub, generation form, thread chips, Today's allowance row, onboarding's plan build,
and the quota screen. No route other than "start a plan build" checks the quota.
Viewing, syncing, undoing and reviewing an existing plan never checks it.

## Parity checklist (per screen)

Legend: ✔ shared component renders the same structure on both; ◐ platform variant exists, needs a device look; ☐ not yet verified on device.

| Screen | Hierarchy | Header | Cards / type | Icons | Progress visuals | States | Back / keyboard | Device check |
|---|---|---|---|---|---|---|---|---|
| Today | ✔ | ◐ in-page both | ✔ | ◐ SF / Lucide | ✔ RN views | ✔ | n/a | ☐ |
| Hydration (B03) | ✔ | ◐ native bar / in-page | ✔ | ◐ | ✔ | ✔ | ◐ Android back = close | ☐ |
| Coach hub | ✔ | ◐ (existing frames) | ✔ | ◐ | n/a | ✔ | n/a | ☐ |
| Generation form | ✔ | ◐ | ✔ | ◐ | n/a | ✔ disabled / used up | ◐ keyboard on focus text | ☐ |
| Saved plans / plan | ✔ | ◐ | ✔ (existing PlanCard) | ◐ | n/a | ✔ empty | ◐ | ☐ |
| Quota (D08) | ✔ | ◐ | ✔ | ◐ | ✔ | ✔ | ◐ | ☐ |

Intentional differences: iOS uses native SwiftUI buttons, native bars and SF Symbols; Android
uses the app's own buttons, in-page headers and Lucide glyphs. Same copy, order, actions and
outcomes on both.

## Progress log (2026-10-16)

| Milestone | Status | Files |
|---|---|---|
| M1 Foundation | done | `unistyles.ts` (`hydration`, `hydrationSoft`), `src/theme/icons.ts` + `icon/index.android.tsx` (`droplet`, `sparkles`), `components/layout/card`, `components/feedback/progress-bar`, `components/layout/modal-header` (+ `.android`), `components/forms/choice-chips` |
| M2 Hydration | done | `db/schema/water.ts`, `db/schema/user.ts` (`waterTargetMl`, `waterGlassMl`), `drizzle/0031_water_log.sql` (+ journal, snapshot, `migrations.js`), `services/backup/tables.ts` (device-only), `constants/water.ts`, `crud/water`, `hooks/use-water.ts`, `screens/home/components/hydration`, `screens/hydration`, `routes/hydration.tsx` |
| M3 Today | done | `screens/home/index.tsx` (order, no blocking spinner, placeholder), `home/components/greeting` (date eyebrow, "Today", avatar → You), `home/components/daily-summary` (→ `/day?date=`), `home/components/allowance` (→ `/quota`), `home/components/up-next` (no plan → Coach when AI is available, editor kept) |
| M4 Coach | done | `screens/syn/index.tsx` (hub as empty state, build chips open the form, quota line → `/quota`, "Your plans" chip), `syn/components/hub`, `screens/coach/new` (D02/D05), `screens/coach/plans` + `coach/plan` (D07), `screens/quota` (D08), `routes/coach/*`, `routes/quota.tsx`, `routes/_layout.tsx`, `crud/ai` (`getPlans`), `hooks/use-ai.tsx` (`usePlans`), `db/schema/ai.ts` (`eggetarian`), `ai/prompt.ts` (region wording), `screens/onboarding/index.tsx` (cost line on the last step), `analytics/events.ts`, `locale/resources/en/screens.json` + bundle |

Checks run: `tsc --noEmit` (iOS program) and `tsc --noEmit -p tsconfig.android.json` both pass;
ESLint on every changed file: 0 errors (3 pre-existing warnings in `unistyles.ts`);
`drizzle-kit generate` reports no pending schema change after `0031`; `bun run test:ci`: 47 suites passed, 1 skipped, 543 tests passed.
Not run: any native build, simulator or device session (Windows checkout, no iOS toolchain;
standing instruction is one EAS preview build at the end).

### Still open

- **Deploy**: #13 and #14 are written but need `0012_ai_usage_report.sql` applied and
  `syn-complete` redeployed (in that order). Until then the app keeps showing the device count
  with its caveats.
- **B (backend)**: #15 billing / entitlement / restore. The UI says plainly that extra builds
  are not available.
- **P1**: dietary profile editor in You (#16), onboarding diet/constraints step (#18),
  connected-data status (#19). Until #16, diet and allergies are edited in the meal-plan form,
  which saves them to the profile when a plan is built.
- The device count (`countPlansThisMonth`) uses the local calendar month and counts saved plans;
  the server counts every answered JSON request per UTC month. They can disagree near month end
  and after intake questions, which is why the server's count replaces the device's once a
  request has answered; until then (each fresh launch) the device count shows, labelled as such.
  The Syn thread's "resets …" line still computes its date locally.
- A returning user with an existing conversation sees the thread, not the hub; the hub's two
  builds are the first two chips there, and "Your plans" is a chip.
- Hindi strings for the new screens fall back to English, as with the rest of v2.
- Device checks for every row of the parity checklist above.

## Pass 2: whole-app restyle (2026-10-16)

**Global:** dark only (`unistyles.ts` initial theme, `applyTheme` pins dark, `app.config.js`
`userInterfaceStyle: 'dark'`, splash `#08090b`); the brief's palette on the neutral and brand ramps
(`#08090B` page, `#14161A` card, `#1B1E23` raised, `#9A9FA8` secondary, `#F5F6F7` text,
`#FF3B4F` accent) and a near-invisible card hairline, so every screen moves at once.

**Layout changes:** Plan (selectable day strip with a filled chosen day, day filter, session rows
with tinted glyph + big coloured figure + weekday, month-style headers); workout detail
(full-bleed hero, "Workout Details" card, label-over-figure grid); exercise detail (name on the
page, animation alone on its white plate; fixed white-on-white title on iOS, same fix in the
guide); Progress (two-column metric tiles); You (Android rebuilt as grouped sections with a
profile card, iOS regrouped into Goals / Preferences); Today week tiles and Nutrition stat tiles
(label over figure); onboarding steps (large centred heading); Welcome (brand mark); choice chips
(filled grey pills).

**Pass 3 layout changes (the screens pass 2 left on the palette only):** workout player (session
clock centred in the top bar, "Set 2 of 4" eyebrow, larger title, a scrubber-style bar of sets done
across the session); rest (thick gradient countdown ring, round −15 / +15 either side); finish
(metric tiles for time, sets, exercises); Coach thread (accent user bubbles and card replies on
both platforms, the plan card laid out as Review Plan with a status eyebrow and per-day row
groups, accent send button); Nutrition (week strip with week arrows replacing the day pill, day
title, glyph per meal; its Build plan now opens the meal-plan form instead of spending a build in
one tap); inbox (grouped cards with uppercase headings and a tinted glyph per kind); day summary
(week strip that changes the day in place, large training-time headline); exercise library (each
muscle group a row with a tinted glyph, its exercises grouped on one rounded card; this also
restyles exercise select); sign-in (centred heading, email and password grouped on one card);
forgot / new password and check email (cards on both platforms, a full primary action); settings
pages (intro card and accent icon tile on both platforms; Android switches and choice pills now
match iOS: accent track, white thumb, accent selected pill).

**Still palette only:** the workout editor and the exercise filter sheet (form-heavy, already
grouped), and the screens unhooked below.

**Unhooked (files kept, nothing opens them):**

| Page | Route | How it is unhooked | Why |
|---|---|---|---|
| Theme | `/settings/theme` | row removed from You (both platforms) | the app is dark only |
| Date and time | `/settings/datetime` | row removed from You | runs on the locale defaults |
| Heart-rate zones | `/settings/heartrate` | row removed from You | niche; the default formula stays |
| Rating prompt | `/review` | `REVIEW_PAGE_ENABLED = false` in `hooks/use-app-review-prompt.tsx` | a custom pre-prompt before the store's own; the store prompt is still in You |

Kept on purpose: Language (Hindi is partial, so a Hindi device needs the way back to English),
Notifications inbox, Sound and Auto-lock (both change the workout player).

Checks (after pass 3): both typechecks pass; ESLint 0 errors on every changed file;
`bun run test:ci` 47 suites, 544 tests passed. No device or native build run.
