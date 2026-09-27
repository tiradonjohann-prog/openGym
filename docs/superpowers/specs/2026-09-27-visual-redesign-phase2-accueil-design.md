# Visual Redesign Phase 2 — Accueil (Home) Screen Design

**Branch:** `feature/visual-redesign-phase2-accueil` (forked from the tip of `feature/visual-redesign-phase1`)

**Depends on:** `feature/visual-redesign-phase1` (design tokens `--glass-fill`/`--glass-border`/`--glass-highlight`/`--glass-shadow`, `--font-display`/`--font-body`, `.card`, `.btn.cta`, `.pill-toggle`, the FAB tab-bar — see `docs/superpowers/specs/2026-09-26-visual-redesign-phase1-foundations-design.md`)

**Mockup source:** `01-Accueil.html` (dark) / `01-Accueil.html` (light), from the two mockup zips the user supplied. Structural reference: header → 2 mini-stat cards → "Prochaine séance" hero → "Progression récente" → "Nutrition" → 7-tab bar (this app keeps its existing 6-tab + FAB bar from Phase 1, unaffected here).

## Goal

Apply the Phase 1 visual foundations to the actual Home screen (`frontend/src/views/Home.jsx`), restructuring both `ProgrammeHome` and `ClassicHome` to match the mockup's information hierarchy, while preserving 100% of the interactive functionality built in `feature/home-plan-redesign` (Phase B): the swipeable, order-free, ad-hoc-session-capable weekly checklist (`ProgrammeWeekCarousel`), confirm-before-start, pause/resume, and quick-log entry points.

## Resolved Design Questions

Two structural tensions were identified between the mockup and the existing app and resolved with the user before writing this spec:

1. **Hero card vs. carousel.** The mockup shows one simple "Prochaine séance" card with no multi-week browsing. The app already has a fully-built swipeable multi-week checklist (`ProgrammeWeekCarousel`, Phase B) that exists only on Home today — nowhere else in the app. Resolution: adopt the mockup's simple hero card as the default view, but add a "Voir les semaines" toggle in/beside the hero that expands the *existing* carousel inline, collapsed by default. No functionality is removed — it changes from always-visible to opt-in-visible. Once a session is marked done, the hero always shows the true next incomplete session across every week of the programme — this is exactly `nextSession(prog, S.routines)`'s current behavior, unchanged.
2. **"Série active X jours" stat.** The mockup's second mini-stat is a day-based training streak with a personal-best record. This app has no day-based streak calculator (`lib/history.js` only has week-based `streakWeeks`), and building one was not requested. Resolution: replace this card's *content* entirely (same slot/shape) with a **body-weight + trend** card: last weigh-in, a trend arrow (up/down/stable), and a small "Log" button. Tapping "Log" opens the existing `bwSheet()` sheet — the same body-weight bottom sheet already used from `Stats.jsx`, `BodyWeight.jsx`, `Profile.jsx`, and elsewhere in `Home.jsx` today. No new sheet, no new popup; this reuses what already exists.

## Layout — ProgrammeHome (has an active programme)

In visual order, top to bottom:

1. **Header** (unchanged): greeting, date, settings gear icon. Restyled only insofar as `.font-display` is applied to the "Bonjour, {name}" heading to match the mockup's Space Grotesk weight.
2. **Mini-stat row** — two `.card`-based cells side by side (`display:grid;grid-template-columns:1fr 1fr;gap:10px`), replacing the current unstyled header block:
   - **"Cette semaine"**: `X / N` sessions done this week of the active programme (via `sessionStates(prog, prog.currentWeek)`, counting `'done'` entries against `prog.routineIds.length`) + a 3px progress bar (`--acc` fill).
   - **"Poids"**: last weigh-in (`lastBW(S)`), a trend arrow computed the same way `ClassicHome` already does (`delta = bw.w - prevBW.w`, `trendDir` = 'up'/'down'/'stable' at a ±0.3 threshold), and a small chip button "Enregistrer" that calls `bwSheet()`. When there's no weigh-in yet, the card shows "Aucune pesée" + the same Log button.
3. **"Prochaine séance" section** — `.cf-sectionhead`-equivalent (`<h3>` + a small link-styled toggle, see below) then the hero card:
   - Pulsing accent dot (`.card` with `--acc`-tinted border/background, `border:1.5px solid color-mix(in srgb,var(--acc) 32%,transparent)`), "Prochaine · {routine.name}" label, a duration estimate if available (else omitted — this app doesn't currently store a per-routine estimated duration; **not invented**, the mockup's "45 min" is decorative-only in the source and has no backing data here, so it's dropped rather than fabricated).
   - Routine name (`.font-display`, ~19px/700) + muscle groups line (from the routine's exercises' body parts, joined with " · " — reuse whatever join helper `Workout.jsx`/routine summaries already use; if none exists, a one-line join is trivial and stays inside this task, not a new shared utility).
   - `.btn.cta` "Démarrer la séance" (gradient shimmer, from Phase 1) wired to the *exact same* handler as today: `confirmStartSheet(ns.routine, () => startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx))`.
   - When `S.active` is set (a workout is in progress or paused), this hero swaps to a "reprendre" state — reuses the tab-bar's existing pause/resume affordance; the hero itself just shows a "Séance en cours — {routine.name}" line with a "Reprendre" `.btn.cta` calling `resumeWorkout()` + navigate, matching what `TabBar.jsx`'s `startWorkout()` already does. No new state machine — this is presentation only, reading `S.active`.
   - When there is no next session (programme fully complete), show a completion message instead of the hero, with a link to view the programme (no new logic — `nextSession` already returns `null` in this case; check the existing `ProgrammeHome`/`ProgrammeCard` for how completion is currently signaled, if at all, and mirror it).
4. **"Voir les semaines {n}/{total}" toggle** — a `.pill-toggle` (Phase 1 primitive) or a plain text-button, placed at the section header's right side where the mockup has "Voir le plan" (that mockup link pointed at a separate Plan screen; here it stays on Home and expands inline instead, since the carousel doesn't exist anywhere else yet). Toggling reveals/hides `ProgrammeWeekCarousel` directly below, collapsed by default on every mount (not persisted). The carousel component's internals (scroll-snap week paging, dot indicators, tile states, `addAdHocSessionSheet`, `workoutDetailSheet`) are **unchanged in behavior** — only its outer `.card` styling picks up the new glass tokens automatically since it already uses `className="card"` plus inline overrides that will be adjusted to use `--acc`/`--glass-*` consistently with Phase 1's `.card`.
5. **"Progression récente"** — new `.card`: "Volume cette semaine" as a number (sum of `workoutVolume(w)` for `w` in `S.workouts` where `weekKey(w.d) === weekKey(todayISO())`, imported from `lib/history.js`/`lib/format.js` — both already imported elsewhere in this file) + unit, and a row of 7 bars (one per day of the current week, Monday-first to match `DAYS`/`weekKey` conventions already used in this file) sized proportionally to that day's volume (bars with 0 volume render at a minimum visual height, matching the mockup's resting-state bars). A small badge shows "1re séance" only when `S.workouts.length === 0`; otherwise no badge (the mockup's badge was itself just an empty/first-run state, not a persistent label).
6. **"Nutrition"** section header + the existing `NutriWidget`, restyled to sit inside a `.cf-sectionhead`-style header ("Nutrition" / "Ajouter" link to `/nutrition`) above it, matching the mockup's section pattern. `NutriWidget` itself needs no logic changes, only wrapping.
7. **"My programmes" card grid** — kept, moved to just above the "Prochaine séance" section header (the mockup has no equivalent, since it assumes a single active programme; this app supports several). This preserves the only way to switch which programme is active from Home.
8. **Quick-log row** (measurements) and **"Log activity" CTA** — kept as-is, restyled to `.card`/`.btn` conventions only.

`SmartNudge` and `LastWorkoutCard` keep their current position (between the hero/carousel block and the nutrition section) and only pick up the new `.card` styling automatically — no structural change.

## Layout — ClassicHome (no active programme)

Same mini-stat row (session count this week from the existing week-schedule data instead of `sessionStates`; weight card identical). The hero becomes "today's routine" (`effectiveRoutine(S, todayISO())`) with the same `.btn.cta` start flow already wired (`confirmStartSheet(r, () => onStart(r.id))`). The existing week-schedule card (today-row + week days) becomes the thing revealed by the "Voir les semaines" toggle, mirroring `ProgrammeHome`'s pattern, instead of always being inline — for visual consistency between the two home variants. Streak card (`streakWeeks(S)`) stays as its own small existing element below the toggle-revealed week view, unchanged in logic; it is not touched by the "Série active" mockup-card decision above, since that decision was specifically about the *mini-stat* card shape, not this separate streak card.

## Out of Scope

- No new pure-logic functions beyond the "volume this week" sum (a 3-line reduction over already-filtered workouts, inlined in `Home.jsx` — not promoted to `lib/history.js` unless it turns out Stats.jsx already has one to share, checked at plan-writing time).
- No changes to `ProgrammeWeekCarousel`'s internal logic (scroll handling, tile state computation, ad-hoc session flow) — restyling only.
- No changes to `TabBar.jsx`, `sheets.jsx`, or any other screen.
- No new "muscle groups" or "duration" data model — both are derived from data that already exists (exercise body parts) or dropped when unavailable (duration), never fabricated.
- Plan/3D/Séance/Stats/Nutrition screens are separate, later Phase 2 sub-projects.

## Testing

This is a UI-restyling/restructuring task with one small new pure calculation (weekly volume sum). Per this project's established convention (Vitest for pure-logic only, no component-test infrastructure): the volume-this-week helper gets a unit test if it's written as a standalone function; if it stays as an inline 3-line reduction with no branching, manual browser verification (both themes, both `ProgrammeHome`/`ClassicHome`, with and without an active programme, with and without prior weigh-ins) is the verification method, consistent with how Phase 1's CSS-only changes were verified.

## Review Focus (for the eventual plan)

- Toggling "Voir les semaines" must not break the carousel's existing scroll-position-sync fix (the `scrollTarget` ref suppression logic from Phase B) — mounting the carousel fresh on every expand (since it's conditionally rendered) means its `mounted` ref resets each time; confirm the initial `scrollToWeek` still uses `'auto'` not `'smooth'` on that fresh mount so there's no visible scroll-snap on expand.
- The weight mini-stat card's "no weigh-in yet" state must not crash on `lastBW(S)` returning `null`/`undefined` — check current null-handling in `ClassicHome`'s existing `bw`/`prevBW`/`delta` computation before reusing it in `ProgrammeHome`, which doesn't compute these today.
- The hero's "programme fully complete" state (`nextSession` returns `null`) must be handled — verify what `ProgrammeHome` does today when this happens (if anything) before assuming a blank/broken hero is acceptable.
- Both themes (dark default `--acc:#7DEFD9`/light `--acc:#0D9488`) and at least 2 of the 8 accent overrides should be spot-checked on the new hero/mini-stat cards, since `.btn.cta`'s gradient currently hardcodes teal/mint hex stops from Phase 1 rather than deriving purely from `--acc` — confirm this is acceptable (already true today) or flag it as a Phase 1 follow-up, not something to silently fix here.
