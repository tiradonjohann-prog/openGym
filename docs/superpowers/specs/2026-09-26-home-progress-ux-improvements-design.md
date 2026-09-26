# Home / progression / UX improvements — design spec

Date: 2026-09-26
Branch: `feature/home-progress-ux-improvements`

## Context

Eight usability issues raised on the OpenGym Sasoian app, spanning the home
screen, programme progression, per-session exercise editing, "beginner mode",
the workout session controls, exercise discovery, the 3D body/exercise list,
and programme week navigation. Each item below was diagnosed against the
current code before design (see conversation history for the full diagnosis).
This spec covers **new behavior only** — items that already work as
requested (e.g. classic-mode home CTA, weight/reps pre-fill, swap-with-
suggestions in-session) are left untouched.

## Goals

1. Programme mode gets the same "what do I do now" clarity classic mode
   already has: a clickable next-session card, and a Démarrer button that
   knows about programme progression.
2. A visible "this programme's progress" summary on Home.
3. Explicit scope choice when swapping an exercise mid-session.
4. A real beginner-friendly mode restricted to Home + the workout screen.
5. A real pause (stops the elapsed-time clock) on the workout screen.
6. Similar-exercise shortcuts on the exercise detail sheet.
7. Three small, independent bug fixes in the 3D body / exercise list view.
8. A read-only week-by-week browser for programmes.

## Non-goals

- Changing how sets/reps pre-fill works (already correct — session-scoped
  logging, cross-session progression by exercise id).
- Changing how "add/remove a set" is scoped (confirmed: current-session-only,
  no prompt — this is already the wanted behavior, no code change here).
- Extending simplified mode beyond Home + Workout (explicitly deferred).
- Global (multi-programme) progress aggregation (explicitly deferred in favor
  of per-active-programme display).

---

## 1. Next session in programme mode

**New pure helper** in `lib/programme.js`: `nextSession(prog, routines)` →
`{ routineId, weekNum, sessionIdx, routine } | null`, wrapping the existing
`nextSessionIdx` across the programme's current (or first incomplete) week.
Returns `null` when the programme is complete or paused.

**`ProgrammeHome`** (`views/Home.jsx`): for the first non-complete,
non-paused programme (existing sort order), render a "Prochaine séance" card
above the last-workout card, mirroring the classic mode's `today-row`
visually (icon, name, session count, a `Start`/`Resume` pill). Clicking it
calls `startFlowForProgramme(programmeId, weekNum, sessionIdx)` (already
exists, currently unused) or resumes `S.active` if one is in progress.

**`TabBar`**: `startWorkout()` first checks for an active programme's next
session (via `nextSession`) before falling back to `effectiveRoutine`
(day-of-week classic plan). Priority order: resume active workout → next
programme session → today's classic-plan routine → open `/workout` picker.

## 2. Per-programme progress on Home

**Correction after further investigation:** `views/BodyWeight.jsx` already
renders a full measurements section (lines 329-452) — per-zone mini trend
charts, deltas, monthly rate, and collapsible session history, reusing
`measureSeries`/`latestMeasurements`/`MEASURE_COLORS` from
`lib/measurements.js`. No new page needed; this part of point 2 is already
satisfied and is dropped from this plan. Only the progress block below is
new work.

**Programme progress block** on `ClassicHome`/`ProgrammeHome`: for the same
active programme used in §1, a small card showing `Semaine {currentWeek}/
{totalWeeks}` and `{doneThisWeek}/{sessionCount} séances cette semaine`,
reusing `completedWeekCount`/`sessionStates` from `lib/programme.js`. Placed
next to (or merged into) the new next-session card from §1 rather than as a
separate component, to avoid two cards saying similar things.

## 3. Exercise swap scope (once vs. always)

Confirmed scope from user: **only the swap gets a choice**; add/remove-set
stays session-only with no prompt (no change needed there).

**`swapExerciseSheet(currentExId, onSwap, routineId)`**: gains a third,
optional `routineId` argument. When present (i.e. the swap happens inside a
routine-backed active session, not a freestyle workout), after the user
picks a replacement exercise, show a small inline choice — via `confirmSheet`
or two buttons in the same sheet — **"Cette séance seulement"** vs. **"Toutes
les prochaines séances de cette routine"**:
- *Cette séance seulement* → current behavior, `onSwap(newEx)` only touches
  `S.active.entries[idx].id` (and its target/plan), nothing else.
- *Toutes les prochaines séances* → additionally updates the matching
  exercise entry inside `S.routines.find(r => r.id === routineId).ex` (or
  `.items` for hybrid routines) so future sessions of that routine start
  with the new exercise. `S.active` for the *current* session is updated the
  same way either way, so the in-progress session always reflects the pick.

When `routineId` is absent (freestyle workout, no backing routine), the
choice is skipped — current-session-only, same as today, since there's no
routine to persist to.

**`Workout.jsx`** passes `A.routineId` into the two existing
`swapExerciseSheet(entry.id, onSwap)` call sites.

## 4. Simplified mode (restricted scope: Home + Workout only)

`S.simpleMode` already exists and is read in two places. Extend it, still
scoped to Home + the workout session screen only — no other view changes.

**Home** (already partially done): keep the existing large CTA card. No
further changes required here beyond what already reacts to `simpleMode`.

**Workout.jsx**, when `S.simpleMode` is true:
- Hide: exercise position volume total in the header (keep elapsed time +
  sets done), the muscle-activation / OneRM-adjacent affordances if surfaced
  mid-session, and the swap-scope choice from §3 defaults silently to
  "cette séance seulement" (no picker shown) — keeps the beginner flow to a
  single tap.
- Keep: the set logging grid (weight/reps/done), rest timer, finish/discard,
  exercise navigation chips, and the new pause control from §6 (essential to
  using the app, not "advanced").

This is additive — wrap the identified blocks in `{!S.simpleMode && ...}`,
no restructuring of the screen.

## 5. Real pause on the workout screen

**Data model**: `S.active` gains two fields, set at creation:
`pausedAt: null` and `pausedMs: 0`.

**`pauseWorkout()` / `resumeWorkout()`** in `sheets.jsx` (next to
`finishWorkout`):
- `pauseWorkout`: `s.active.pausedAt = Date.now()` (no-op if already paused
  or no active workout).
- `resumeWorkout`: `s.active.pausedMs += Date.now() - s.active.pausedAt;
  s.active.pausedAt = null`.

**`Elapsed` component** (`Workout.jsx`): while `A.pausedAt` is set, freezes
the displayed duration at `A.pausedAt - A.start - A.pausedMs` instead of
ticking; the interval simply stops re-rendering the clock (existing
`setInterval`-driven re-render skips while paused).

**`finishWorkout()`** (`sheets.jsx`): effective duration for history/stats
becomes `end - start - pausedMs` (auto-resume — i.e. fold any open
`pausedAt` into `pausedMs` — before computing `end`, so finishing while
paused still records correctly rather than silently keeping the session
"open").

**UI**: the workout header's existing area gains a pause/resume icon button
next to Finish. `TabBar` and `Home`'s active-session indicator switch label
between **Démarrer** (no `S.active`) → **Pause**-capable **Reprendre**
label while active-and-running → and reflect **En pause** state (e.g. a
static icon/tag) when `A.pausedAt` is set, satisfying the requested
Démarrer → Pause → Reprendre progression instead of the current two-state
toggle.

## 6. Similar-exercise shortcuts in exercise detail

**`ExerciseDetail`** (`sheets.jsx`): reuse the exact scoring already proven
in `SwapPicker` (`same bp: +10`, `same eq: +5`, sorted desc) to compute up to
6 similar exercises for `ex`, and render them as a horizontal row of small
tappable thumbnails (icon/mini-image + name truncated) below the muscle
activation section. Tapping one calls `exerciseDetailSheet(similarEx)`
(replaces sheet content — same pattern already used for "View in 3D"
navigation elsewhere in this sheet). No new data source — pure derivation
from `allExercises(st)`, same as `SwapPicker`.

## 7. 3D body view + exercise list — three independent fixes

All three confined to `AnatomyView.jsx` / `index.css`, no data or store
changes:

- **Sticky header**: `.anatomy-panel-hdr` gets `position: sticky; top: 0`
  plus an opaque background matching `.anatomy-panel` (currently transparent,
  which would let list rows show through while scrolled under it) and a
  `z-index` above the list rows.
- **"Load more"**: replace the hard `list.slice(0, 30)` cap with a `shown`
  state (mirrors `Library.jsx`'s existing pattern) starting at 30, `+30` per
  tap, with a "Charger plus" button shown while `list.length > shown`
  (existing "Showing top X of Y" text becomes accurate whatever `shown` is,
  instead of always saying "30").
- **Bottom padding**: `.anatomy-panel`'s bottom padding changes from
  `calc(16px + var(--sab))` to match the app-wide reserved space used
  elsewhere (`calc(128px + var(--sab))` on mobile only — the desktop
  media-query variant at ≥1000px, which removes the fixed tab bar layout,
  keeps its current padding unchanged).

## 8. Programme week browser (read-only)

**New sheet** `programmeWeeksSheet(prog)` in `sheets.jsx`: a simple week
selector (chips or a prev/next stepper, 1..totalWeeks) rendering that week's
sessions via `sessionStates(prog, weekNum)` (done/next/upcoming badges per
session, reusing the same routine-lookup/label helpers already used in
`ProgrammeEditor`). Purely a viewer — no session is launchable from here
except the programme's actual current "next" session (§1), which, if it
falls on the week being viewed, still opens via the normal `startFlowForProgramme`
path; all other rows are inert (no click handler), keeping the sequential
lock intact.

**Entry point**: a "Voir les semaines" affordance on `ProgrammeCard` (e.g. a
small button in the card footer, alongside/instead of tapping the whole card
which currently opens `ProgrammeEditor`) or from within the new next-session
card in §1. Exact placement decided during implementation to avoid crowding
the existing card tap target.

---

## Data model changes summary

| Field | Location | Change |
|---|---|---|
| `S.active.pausedAt` | store | new, `null` \| timestamp |
| `S.active.pausedMs` | store | new, number, default `0` |

No migration needed — both are absent-safe (`undefined` reads as falsy /
`0` via `||` guards), matching this codebase's existing convention for
optional `S.active` fields (e.g. `hybrid`, `sport`).

No other persisted-state shape changes. Measurements and programme data
already carry everything needed (§2, §8 are read-only consumers of existing
`S.measurements` / `S.programmes`).

## Testing

This codebase has no unit test suite beyond one existing
`AnatomyView.test.js`; verification is manual (`npm run dev`, exercised in
the emulator/browser per `superpowers:verification-before-completion`):

- §1: switch a demo account into programme mode, confirm next-session card
  and Démarrer both resolve to the right session; confirm classic-mode
  behavior (already correct) is unaffected.
- §2: log a few measurement entries, confirm the new page renders trends;
  confirm the Home progress block matches `ProgrammeCard`'s own percentage.
- §3: swap an exercise both ways, confirm routine template only changes on
  "always"; confirm freestyle workouts (no routine) skip the choice.
- §4: toggle beginner mode, confirm only Home + Workout change, nothing
  elsewhere in the app.
- §5: pause mid-session, wait, resume, finish — confirm recorded duration
  excludes paused time; confirm TabBar/Home labels cycle through all three
  states.
- §6: open an exercise detail sheet, confirm similar-exercise row matches
  what `SwapPicker` would suggest for the same exercise.
- §7: open the 3D view, select a high-count muscle (e.g. deltoïde antérieur),
  scroll — header stays pinned, "Charger plus" works, last item is fully
  tappable above the tab bar.
- §8: open the week browser for a partially-completed programme, confirm
  done/next/upcoming badges match `ProgrammeEditor`'s own session states,
  confirm no row outside the actual next session is clickable.
