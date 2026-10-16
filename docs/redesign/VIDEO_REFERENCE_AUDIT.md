# Video reference audit

Source: `play_720p.mp4` (supplied by the product owner), 592 × 1280, 30 fps, H.264, **12:01.5**.
Method: one frame every 4 s (181 frames, ten contact sheets), ffmpeg scene detection
(threshold 0.2, 71 cuts, all after 5:37; the first five minutes are slow scrolls and
modal fades that never cross the threshold), and full-resolution stills at 0:50, 1:14,
2:10, 9:41 and 10:34. Timestamps are video time, ±2 s. The phone's own status-bar clock
is quoted where it helps place a cut.

The recording is of Apple Fitness on iOS 18-era UI. It is a **visual and interaction
reference only**: nothing from it (Fitness+ content, trainers, Activity rings, Awards,
Apple wording) is reproduced as Syn branding or semantics.

## 1. Screen inventory

| Time | Screen | What happens |
|---|---|---|
| 0:00–0:36 | **Personalize Fitness and Health** (setup) | Inset grouped list: Date of Birth, Sex, Height, Weight with "Not Set" placeholders. Tapping a row slides a wheel picker up from the bottom (0:04, 0:16, 0:28); Cancel / Done in the nav bar; one full-width Continue button. Values are optional until set. |
| 0:40 | Daily Move Goal | One big number (300 KILOCALORIES/DAY) between − and + round buttons; 3-way segmented control (Lightly / Moderately / Highly); primary "Set Move Goal" at the bottom. |
| 0:44 | Notifications permission | Device illustration, title, one paragraph, Continue. |
| 0:48–0:52 | **Summary** (tab root, first run) | Uppercase date eyebrow "WEDNESDAY, JUN 18", large title "Summary", avatar top right. Dismissible tip card ("A Customizable Summary", Edit Your Summary link). Ring card, then a 2-column grid of compact metric cards (Step Count, Step Distance) each with a tiny hourly bar chart, Sessions, Trainer Tips. |
| 0:56–1:00 | Sessions (empty → populated) | "See all your workouts…" empty copy; populated list rows: coloured activity glyph, name, big coloured duration, weekday right-aligned. Bright full-width "Add Card" CTA. |
| 1:04–1:08 | Summary scrolled | Trends card (empty state with illustration + "Get Started"), Sessions card, then plain "Edit Summary" / "See All Categories" buttons at the end of the feed. |
| 1:12–1:20 | **Activity detail (day)** | Back "‹ Summary", centred date, calendar + share icons. Week strip of 7 mini rings (today highlighted). One big ring, metric label + big value "0/200KCAL", hourly bar chart with axis 12:00/6:00, then Steps / Distance / Flights Climbed as label-over-value pairs. Two side-by-side tonal buttons "Change Goal" / "Pause Ring". |
| 1:24 | Today's goal sheet | Full-height modal with Cancel; same −/value/+ stepper as setup; "Change Move Goal for Today". |
| 1:28 | Context menu | Long-press/tap on goal icon shows a 2-item menu (Adjust Goal for Today, Change Daily Goal). |
| 1:40–1:44 | Pause sheet → paused state | Modal with a dimmed ring and four stacked option buttons (For Today / Until Monday / Until July / Custom). Result: grey ring with "Your ring is currently paused" inside, Resume / Edit Pause buttons. |
| 1:48 | Add To Your Rings | Section listing third-party workout apps. |
| 1:52–1:56 | Month calendar | Full-screen modal, month grid of mini rings, today in red. |
| 2:00 | Share sheet | Standard iOS share sheet over the detail. |
| 2:04 | Swipe-back | Interactive pop: the detail slides right revealing Summary underneath (shadowed edge). |
| 2:08–2:20 | **Metric detail: Steps** | Large title "Steps", subtitle "This Week"; segmented D / W / M / Y; card per metric (COUNT 277, DISTANCE 0.18KM) with uppercase label, big coloured value, bar chart with right-hand axis, weekday or month labels. Changing the segment swaps the range in place (no navigation). |
| 2:24 | **Sessions list** | Large title, horizontally scrolling filter chips (All, Workouts, Traditional Strength Training, Running, …), month section header "June 2025", rows. |
| 2:28–2:36 | Session detail | Back "‹ Sessions", app glyph + title + time range; "Workout Details / Show More"; 2-column label/value grid (Workout Time 0:00:31, Active Kilocalories 0KCAL). A bottom sheet "Workout Details" peeks with an × (2:36). |
| 2:40–2:48 | Delete confirmation | Swipe-to-delete on a row exposes red action; centred alert with two destructive options and Cancel. |
| 2:52–3:04 | Filtered sessions | Chips select (filled accent pill); a Total / Average summary table appears above the filtered rows. |
| 3:08–3:36 | Video player (Fitness+ tip) | Full-screen player, ⨯ / AirPlay / volume, ±10 s and play/pause; overflow menus (Playback Speed, Audio, Subtitles) open as small anchored menus. Not applicable to Syn (no video media). |
| 3:40–3:44 | Summary (scrolled, with Awards) | Awards card with three badge glyphs; Trends now populated (Move, Walking Pace, Distance, Running Pace with arrows). |
| 3:48–3:56 | Awards / award detail | Grid of badges; detail with large badge, title, explanation, progress bar, share. |
| 4:00–4:08 | Trends | List of trend rows: coloured arrow glyph, metric name, value "-/-KCAL/DAY", one-line description. Info modal "Activity Trends" with pictogram and OK (4:12–4:16). |
| 4:24 | Trend detail: Move | Back "‹ Trends", large metric, date range, 12-month chart, explanatory paragraph. |
| 4:36–4:44 | **Edit Summary** | Edit mode: every card gets a red − badge, "+ Add" and Done in the nav bar; cards jiggle-free. |
| 4:48–5:04 | Add a Card sheet | Sheet titled "Add a Card to Your Summary": horizontally paged previews per category (Running, Cycling…), each with a caption; "Add Card" CTA; back to Summary edit mode. |
| 5:12–5:20 | All Categories | Inset grouped list with coloured glyphs and chevrons. |
| 5:24–5:28 | Loading | Centred spinner with a skeleton/placeholder CTA bar while the Fitness+ tab loads. |
| 5:32–5:44 | Subscription offer + purchase sheet | Marketing hero, "Try 1 Month Free", "Try It Free" CTA, fine print; system purchase sheet (Confirm with Side Button). **Not applicable**: Syn has no paid content. |
| 5:48–6:20 | Fitness+ For You / Explore | Hero carousel with "Let's Go", rails of thumbnails, activity-type tiles, Awards. Content catalogue, not applicable. |
| 6:24 | Personalisation question | Full-screen question with two stacked choice buttons. |
| 6:28–7:00 | **Workout detail** | Hero image, title over image, metadata line, one dominant "Let's Go", secondary "Preview", description with MORE, Music, Related. Overflow (…) menu: Delete from Library, Download, Add to Stack, Share. Checkmark replaces + after adding. |
| 6:56 | Stack sheet | Bottom sheet listing queued items, "Let's Go", "1 Workout · Total: 5min". |
| 7:12–7:28 | Trainer page + Filter sheet | Filter sheet: Type / Time / Music chips, Cancel/Clear All/Done. |
| 7:48 | Landscape player | Rotated full-screen video. |
| **8:00** | **Countdown** | Black screen, large thick progress ring (green→lime) around a big numeral: the 3-2-1 lead-in before a session starts. |
| 8:08–8:20 | Awards (Fitness+) | Weekly streak badge detail, "Your current streak is 0 weeks". |
| 8:24–8:52 | Explore, artist page, Programs, Collections | Content catalogue, not applicable. |
| 8:52–9:04 | **Custom Plans** entry, Trainer Tips | Card "Custom Plans — Build Your Plan ›". |
| **9:20–9:32** | **Build Your Plan** (form) | Modal, Cancel. Geometric header art. Sections: **Weekly Schedule** (7 circular day toggles M–S, selected = accent ring), Total Time Per Day (30min ⌃⌄ menu), Length of Plan (4 Weeks ⌃⌄ menu, 9:32 shows the anchored pop-up 2–8 weeks with a check); **Activity Types** 3-column tile grid with icon + label, selected tile gets an accent outline. "Review Plan" pinned at the bottom, **disabled (greyed) until a day and an activity are chosen**, then filled accent. |
| **9:40–9:52** | **Review Plan** | Large title, "Starts Monday, June 23 ⌄" (anchored date menu, 9:41: Today / Mon / Tue / Wed); Weekly Schedule card per day: day name + total minutes, rows of activity glyph / name / minutes / chevron, "+ Add". **Preferences** (Trainers +, Music +). "Create Plan" pinned at the bottom. Tapping a row opens an edit sheet (9:44: Activity picker, Time chips 10/20/30/45 MIN, Cancel / Add). |
| 9:56–10:04 | Preferences sheets | Trainers and Music chip pickers per activity, Update. |
| 10:24 | Library → Custom Plans | Plan row: art, "My Plan", activity list, **"ACTIVE · 1 OF 2"** status label. |
| **10:32–10:40** | **My Plan** (active plan) | Nav title "My Plan" / "Week 1 of 2", overflow menu; 7-day date strip (selected day filled white circle, small dots under days that have sessions); list of that day's sessions as large image cards. Changing the day swaps the list in place. |
| 10:52–10:56 | Stack empty state | Pictogram, "Create a Stack" title, one paragraph of guidance. |
| 11:00–11:08 | Sharing onboarding | Paged illustration, title, body, small privacy line, "Get Started". Not applicable. |
| 11:12–11:20 | Sharing empty / compose | Empty card with "Invite a Friend"; compose sheet with To:. Not applicable. |
| 11:24–11:28 | Summary (populated) | Cards after edits. |
| **11:32** | *(cut: status clock jumps 1:34 → 2:21)* | Footage between is missing. |
| 11:32–11:56 | **Account / settings** | Personalize Fitness and Health (editable profile, Done), Account sheet: profile row (name + email), Health Details, Change Move Goal, Units of Measure, Notifications, Redeem/Send gift (n/a), Privacy. Units of Measure: inset groups per activity with check-marked options. Notifications: grouped switches with footnote captions. |

## 2. Transitions and interactions

- **Push / pop** (2:04): standard horizontal push with interactive swipe-back; the previous screen's large title collapses into the back label ("‹ Summary"). Duration looks ~300 ms.
- **Sheets**: three kinds. Full-height modal with Cancel/Done (goal edit 1:24, Build Your Plan 9:20); detented bottom sheet with grabber (Workout Details 2:36, Stack 6:56); anchored pop-up menu (Total Time, Length of Plan, Starts date 9:32/9:41).
- **In-place range switch**: D/W/M/Y segments (2:08) and the plan day strip (10:32) replace content without navigation.
- **Disabled → enabled CTA** (9:28 → 9:30): the bottom CTA stays put and changes fill when the form becomes valid.
- **Selection feedback**: day toggles and activity tiles get an accent outline, not a fill; chips fill when active (2:52).
- **Destructive actions** are always confirmed (2:40 delete alert).
- **Edit mode** on the feed (4:36) is an explicit mode with Done, not long-press-and-drag.
- **Loading** (5:24): spinner + skeleton bar, shell visible immediately.
- **Countdown** (8:00): ring progress around a big number before a session.
- Tap highlights in the recording are the screen recorder's touch indicator (blue dot), not app UI.

## 3. Visual observations

- **Surfaces**: pure black page; cards ~#1C1C1E with ~12–16 pt radius, no borders, 8–12 pt gaps; side gutters ~16 pt.
- **Type**: SF Pro. Large titles ~34 pt bold; card titles ~17 pt semibold; metric values large (~28–34 pt) in a rounded/condensed numeric face with **units in small caps directly after the number** ("0.00KM", "0/200KCAL"); uppercase micro-labels (COUNT, DISTANCE) above values.
- **Colour**: values are coloured by metric (one hue per metric, consistently across card, chart and detail); chrome is greyscale; a single accent for primary CTAs and selection.
- **Charts**: minimal bars, faint gridlines, right-hand axis with 2–3 ticks, short axis labels, no legends; empty data still draws the axis.
- **Iconography**: filled glyphs in coloured circles for activity types; SF Symbols for chrome (chevrons, ellipsis, calendar, share).
- **CTAs**: one bright, full-width, rounded (~12 pt) primary per screen pinned at the bottom of forms; secondary actions as tonal grey buttons, often in pairs.
- **Empty states**: pictogram + one-line title + one paragraph + optional CTA, always inside the card that would hold the data.

## 4. Mapping to Syn

| Reference | Syn screen (spec id) | Notes |
|---|---|---|
| Summary (0:48, 11:24) | **B01 Today** | Date eyebrow + large title + avatar; vertically scrolling cards with one metric and one interaction each. Syn's daily summary uses **bars, not rings** (DESIGN_BRIEF §2). |
| Activity day detail (1:12) | B02 Daily activity detail | Syn has no move/steps source of its own; the pattern (week strip + big value + breakdown) is used for hydration (B03). |
| Goal stepper (0:40, 1:24) | B03 water target / glass size | −/value/+ stepper is the reference for editing the daily water target. |
| Metric detail D/W/M/Y (2:08) | E02 Trends | Existing Progress charts already follow this; no new range switcher added in this pass. |
| Sessions list / detail (2:24–2:36) | C07 Session history/detail | Existing Plan → history list and workout screen. |
| Delete alert (2:40) | Guarded destructive actions | Existing pattern (Alert with destructive style). |
| Build Your Plan (9:20) | **D02 / D05 generation form** | Prefilled choices, bottom-pinned CTA disabled until valid, quota shown before submitting. |
| Review Plan (9:40) | **D04 / D06 review** | Existing plan card + Preview changes sheet; "Starts" date and per-day rows. |
| Custom Plan "ACTIVE · 1 OF 2" (10:24) | **D07 Saved plans** | Draft / Active / Archived status label on each plan row. |
| My Plan day strip (10:32) | C01 Weekly plan | Existing Plan week strip. |
| Countdown ring (8:00) | C04 player lead-in | Existing timer/rest ring; no new countdown added. |
| Empty states (0:56, 10:52) | Every card | Pictogram-free in Syn (no illustration assets), title + one line + action. |
| Account / Units / Notifications (11:32–11:56) | E03 / E05 You tab | Existing native settings rows. |
| Fitness+ catalogue, trainers, music, video player, Sharing, Awards, gift cards, purchase sheet | — | **Not applicable**: Syn has no paid content library, video media, social sharing or badges. Not built. |

## 5. Uncertainties

- The cut at 11:32 (status clock 1:34 → 2:21) hides ~47 minutes of real time; how the account sheet was reached is not shown.
- 5:24–5:28 shows a spinner; whether that is network latency or an intentional skeleton is not determinable.
- Exact animation curves and durations cannot be measured reliably at 30 fps with 4 s sampling; push/pop and sheet timings above are estimates.
- Haptics and sounds are not observable in a screen recording.
- The recording is iOS only; there is no Android reference, so Android parity is judged against the iOS frames.
