# Home / Plan navigation redesign — design spec

Date: 2026-09-26

## Context

Follow-up to the `feature/home-progress-ux-improvements` branch (programme
next-session card, pause/resume, swap scope, etc.) — that work surfaced a
deeper problem: Home and Plan currently run **two parallel planning
systems** (multi-week Programmes vs. the older day-of-week classic
schedule) without a clear hierarchy, and starting/tracking a programme
session has no confirmation step, no weekly checklist, and no way to log a
spontaneous extra session without disturbing programme progression.

This spec covers five items, all interdependent through the same data-model
change (linking a finished workout back to the programme session it
fulfilled):

1. Consolidate Démarrer/Pause/Reprendre into one button (tab bar).
2. Deleting a past workout re-opens its programme slot if progress has
   moved past it.
3. Home: a single consolidated programme card with a checkable weekly
   session list, replacing today's next-session card.
4. A confirm-before-start step, everywhere a session can be launched.
5. Plan: programme-first layout, classic day-of-week grid collapsed behind
   a toggle, plus a route from the programme card on Home into Plan's edit
   flow.

Confirmed with the user:
- Confirmation-before-start applies **everywhere** a session launches (tab
  bar's quick-start button included), not just Home's checklist.
- A spontaneous/ad-hoc session is picked from the existing routine library
  only (no freestyle/build-as-you-go option for this flow).
- The classic day-of-week grid is collapsed behind a "Voir le planning
  classique" toggle on Plan when a programme is active, not removed.
- **Sessions within and across weeks can be done in any order, including
  starting a future week's session before the current week is finished.**
  This explicitly **supersedes** the sequential-lock behavior confirmed
  earlier in the original 8-point round (§8 there) — that ruling is
  overridden by this later, more specific instruction. The week/session
  labeled "prochaine" is now a *suggestion* (visual only), never a gate.

## Goals

- One mental model on Home: "what's my active programme, what's next, what
  have I done this week" — answerable at a glance, and actionable (check
  off, start, add extra) without leaving the screen.
- No session starts by accident — every launch path asks first.
- Deleting a workout is safe to do without silently breaking programme
  progress tracking.
- Plan stops presenting two competing schedules at once.

## Non-goals

- Merging the classic day-of-week system and the programme system into one
  concept (spec §3's "Option B" from the earlier discussion) — collapsing
  the grid behind a toggle is the agreed scope for now, not removing it.
- Changing routine/exercise composition editing (`RoutineEdit.jsx`) — out
  of scope, already a dedicated, working screen.
- Multi-programme juggling UI — Home continues to surface one active
  programme at a time (`activeProgramme`'s existing "first eligible"
  selection), unchanged.

---

## 1. Data model: link a finished workout to its programme slot

**`S.workouts[].programmeId` / `.progWeek` / `.progSessionIdx`** (all
optional, `null`/absent for non-programme workouts) — copied from
`S.active` onto the record in `doFinishWorkout` (`sheets.jsx`, where `w` is
built), exactly the fields `startFlowForProgramme` already sets on
`S.active` via `progCtx`. Absent-safe, no migration needed.

**`S.workouts[].adHoc`** (boolean, default falsy) — set when the session was
started via the new "add an extra session" flow (§3). An ad-hoc session
still carries `programmeId`/`progWeek` (it belongs to that week) but no
`progSessionIdx` (it isn't one of the programme's fixed slots) — `doFinishWorkout`'s
existing `if (A.programmeId != null && A.progWeek != null && A.progSessionIdx
!= null)` guard already skips the `weekProgress` write for these, for free.

**Delete-workout reopens the slot**: in `WorkoutDetail`'s delete handler
(`sheets.jsx`), when the deleted workout carries `programmeId`/`progWeek`/`progSessionIdx`:
1. Set `prog.weekProgress[progWeek][progSessionIdx] = false`.
2. If `prog.currentWeek > progWeek`, set `prog.currentWeek = progWeek` —
   the programme "rewinds" to the week containing the now-unfinished
   session, so it resurfaces as the next session to do (this is exactly
   what the already-fixed `nextSession` — which trusts recorded-incomplete
   weeks over a stale `currentWeek` — was built to handle correctly).
3. If `prog.currentWeek === progWeek` or `prog.currentWeek < progWeek`, no
   `currentWeek` change needed — the week is already current or in the
   future.

No confirmation dialog beyond the existing "Delete workout?" — the rewind
is a direct, expected consequence, not a separate destructive action.

## 2. Single Démarrer/Pause/Reprendre button (tab bar)

Replace `TabBar`'s current click behavior (always navigates) with a state
machine on the same button:

| `S.active` | `S.active.pausedAt` | Tap does |
|---|---|---|
| absent | — | Confirm-then-start next session (§4) |
| present | absent (running) | **Pause in place** — calls `pauseWorkout()` directly, no navigation, stays on current screen |
| present | set (paused) | **Resume** — calls `resumeWorkout()` then navigates into `/workout` (or `/cardio`) to continue logging |

The icon/label cycle (`dumbbell`→"Start", `play`→"Resume", `pause`→"En
pause") already exists from the previous branch; only the *click handler*
changes. The pause icon button inside `Workout.jsx`'s header is removed —
this tab-bar button is now the only pause control, reachable from any
screen.

## 3. Home: consolidated programme card with a swipeable weekly tile grid

Replaces the current `NextSessionCard` (from the previous branch) **and**
retires the previous branch's read-only `programmeWeeksSheet`/calendar-icon
entry point on `ProgrammeCard` (Task 11 there) — this new card is both the
week browser and the launcher, so a second, separate, read-only UI for the
same concept would just be a second place to keep in sync. Still rendered
only when `activeProgramme(S)` returns a programme.

```
┌───────────────────────────────────────────┐
│ PROGRAMME MAMAN                        6/8 │  ← name, completed-weeks badge (outer header)
│ ▓▓▓▓▓▓░░░░░░░░░░░░░░░░  (overall progress) │
├───────────────────────────────────────────┤
│ Semaine 3/8                                │  ← viewed week's own header
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐│
│ │  Push   │ │  Pull   │ │  Legs   │ │ Core  ││  ← one tile per session this week
│ │   ✓     │ │   ✓     │ │ ▶ Proch.│ │       ││
│ │  vert   │ │  vert   │ │  jaune  │ │  gris ││
│ └────────┘ └────────┘ └────────┘ └───────┘│
│ + Ajouter une séance                       │
├───────────────────────────────────────────┤
│         ‹  •  •  ○  •  •  •  •  •  ›       │  ← week dots, swipe left/right
└───────────────────────────────────────────┘
```

- **Outer header** (static, not part of the swipe): programme name +
  overall `completedWeeks/totalWeeks` badge + progress bar — unchanged
  from the previous branch's card.
- **Swipeable body**: one page per training week, `1..prog.totalWeeks`
  (`prog.totalWeeks` — an explicit *training*-week count, not calendar
  weeks; the page index is exactly `weekNum` already used everywhere in
  `lib/programme.js`, no new concept needed). Horizontal swipe/scroll
  between pages; small dot indicators below the card show position and
  are tappable to jump. Each page's own header reads "Semaine
  `{weekNum}`/`{prog.totalWeeks}`".
- **Session tiles**, one per `prog.routineIds` entry for the viewed week,
  laid out in a wrapping row/grid. State per `sessionStates(prog, weekNum)`
  (already exists, unchanged) maps to tile style — **all three states are
  tappable now**, not just "done" and "next":
  - `done` → green fill/border, checkmark, tap opens `workoutDetailSheet`
    for the matching `S.workouts` entry (looked up by `programmeId`/`progWeek`/`progSessionIdx`
    — new pure helper `workoutForProgSession(S, programmeId, weekNum,
    sessionIdx)`). Deleting from there already reopens the slot (§1) —
    the tile flips back to yellow/grey on the next render, no extra code.
  - `next` (first incomplete session, whichever week it's in) → yellow
    fill/border, "Prochaine séance" badge, tap opens confirm-start (§4)
    for that session.
  - `upcoming` (every other not-done session, this week or any other) →
    grey fill/border, no badge, **still tappable** — opens the same
    confirm-start sheet for that specific session. This is what makes
    starting a future week's session, or picking a different session than
    the suggested one, possible — see the Context section's confirmed
    early-start behavior.
- **Ad-hoc tiles**: this week's `S.workouts` with matching `progWeek` and
  `adHoc: true` are appended after the fixed tiles, always green/done
  (they only exist once logged).
- **Auto-advance follows the view**: a `viewedWeek` local state initializes
  to `prog.currentWeek`. When `prog.currentWeek` changes (the existing
  auto-advance in `doFinishWorkout` fires) *and* the user hadn't manually
  swiped away from the previously-current week, `viewedWeek` updates to
  track it — the carousel follows you into the new week automatically. If
  the user had manually navigated to a different week, their position is
  left alone (they're intentionally browsing elsewhere).

### 3.1 Adding a spontaneous session

"+ Ajouter une séance" (present on every week page, not just the current
one — you can log an extra session against whichever week you're viewing)
opens `exercisePicker`-style routine list (reuse the existing
routine-picking list pattern from `AddToRoutine`/`ExercisePicker`, scoped
to `S.routines` instead of exercises) — any routine type is fine. Picking
one calls:

```js
startFlow(routineId, { programmeId: prog.id, progWeek: viewedWeek, adHoc: true })
```

(no `progSessionIdx` — this is the signal that keeps it out of
`weekProgress`). This still goes through the confirm-before-start step
(§4), same as any other launch.

## 4. Confirm-before-start (applies everywhere)

**New sheet** `confirmStartSheet(routine, onConfirm)` in `sheets.jsx`: shows
the routine's name, glyph, and a one-line summary (`exCount`/duration, the
existing `routineSubtitle`-style helper from `Plan.jsx` — promoted to
`lib/` so both files can use it), with a primary "Lancer" button and a
"Annuler" button. `onConfirm` is whatever the caller would otherwise have
called directly (`startFlow(routineId)` / `startFlowForProgramme(...)`).

**Call sites updated to go through it:**
- `TabBar.startWorkout` (§2's "no active session" row) — resolves the
  target routine/programme session first (unchanged resolution logic),
  then opens `confirmStartSheet` instead of calling `onStart`/`startFlowForProgramme`
  directly.
- Home's programme-card tiles (`next` **and** `upcoming` states alike —
  any tappable tile) and "+ Ajouter une séance" (§3, §3.1).
- Home's classic-mode "today" row (`ClassicHome`, unchanged resolution,
  now funnels through the same confirm sheet) — kept consistent rather
  than leaving classic mode as the one path that still launches instantly.

Resuming an in-progress (unstarted-but-existing) session never shows this —
confirmation is only for *starting* something new, matching the state
machine in §2 (resume just navigates, no dialog).

## 5. Plan: programme-first layout

Reorders `Plan.jsx`'s sections and collapses the day-of-week grid:

1. **Programmes** (unchanged position/content — the grid of `ProgrammeCard`s).
2. **Classic weekly plan** — collapsed by default behind a "Voir le
   planning classique" toggle **only when `activeProgramme(S)` is
   non-null**; shown expanded by default (current behavior, unchanged)
   when there's no active programme, since it's then the only planning
   system in play.
3. **Routines** (renamed section header to "Bibliothèque de séances" to
   signal it's building blocks, not a schedule — content unchanged).

**Programme card → Plan navigation** (the earlier-agreed point 4):
`ProgrammeCard`'s main tap target changes from directly opening
`programmeEditSheet(prog)` to `nav('/plan')` followed by opening that same
sheet — a one-line change, conditional on not already being on `/plan`
(check `useLocation().pathname` so tapping a card already on Plan doesn't
double-navigate).

**Retiring the Task 11 read-only week browser**: the previous branch's
calendar-icon button on `ProgrammeCard` and the `programmeWeeksSheet`/`ProgrammeWeeks`
component it opened are removed — §3's swipeable card on Home is now the
one place that browses *and* acts on any week's sessions, so keeping the
old read-only sheet around would just be a second, divergent UI for the
same data (it still enforces the now-superseded "only the current week's
next session is actionable" rule). `ProgrammeCard` goes back to a single
tap target (the nav-to-Plan behavior above) plus its existing delete
button — no second icon button.

---

## Data model changes summary

| Field | Location | Change |
|---|---|---|
| `S.workouts[].programmeId` | store | new, optional, copied from `S.active` at finish |
| `S.workouts[].progWeek` | store | new, optional, copied from `S.active` at finish |
| `S.workouts[].progSessionIdx` | store | new, optional, copied from `S.active` at finish |
| `S.workouts[].adHoc` | store | new, optional boolean, set when started via §3.1 |

All absent-safe; no migration. Deleting an old (pre-this-change) workout
that predates these fields simply skips the rewind logic (fields are
`undefined`), same as today.

## Testing

Consistent with the previous branch's approach — `lib/*.js` pure logic
gets Vitest coverage: the delete-rewind decision (*whether* and *how far*
to rewind `currentWeek`, §1) and `workoutForProgSession` (§3's done-tile
lookup) should both be extracted as pure functions and tested the same way
`nextSession` was. UI changes (the swipeable card, tile states, confirm
sheet, tab-bar state machine, Plan's collapsed grid) are verified via
`npm run build` + manual walkthrough, per this codebase's existing
convention of no component-level test infrastructure.
