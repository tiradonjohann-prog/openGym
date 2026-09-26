# Home / Plan Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild how OpenGym Sasoian surfaces and launches programme
sessions — one consolidated Démarrer/Pause/Reprendre control, a swipeable
per-week tile carousel on Home (order-free, any week startable early),
spontaneous extra sessions, a confirm-before-start step everywhere, a
workout-delete that correctly reopens the programme slot it fulfilled, and
a Plan screen that leads with programmes instead of two competing
schedules.

**Architecture:** Same conventions as the previous branch — new pure logic
in `frontend/src/lib/*.js` with Vitest coverage; UI changes in
`views`/`components`/`sheets.jsx` verified via `npm run build` + manual
walkthrough (no component-test infra in this codebase). The week carousel
uses native CSS scroll-snap for the swipe interaction — no new dependency.

**Tech Stack:** React 19 (JSX), Zustand (`useStore.js`), Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-26-home-plan-redesign-design.md`

**Task order note:** tasks are numbered in the order they must be
executed — several later tasks import something an earlier one exports
(`confirmStartSheet` from Task 3 is needed by Tasks 4, 5, 6;
`addAdHocSessionSheet` from Task 5 is needed by Task 6). Running them
out of numeric order will hit an unresolved-import build failure.

## Global Constraints

- No TypeScript — plain JSX/JS, matching every existing file.
- Store mutations only via `update(s => {...})` (Immer draft).
- Every new field on `S.workouts[]` is optional/absent-safe — no migration.
- Confirm-before-start applies to **every** launch path (tab bar, Home's
  carousel tiles, the spontaneous-session picker, classic mode's today
  row) — no path may call `startFlow`/`startFlowForProgramme` directly
  from a click handler once this plan is done.
- Sessions are **order-free**: any tile in any week (current, past, or
  future) is startable at any time. This explicitly supersedes the
  sequential-lock behavior from the earlier `feature/home-progress-ux-improvements`
  branch — do not reintroduce a lock check anywhere in this plan.
- The read-only week browser from that earlier branch (`programmeWeeksSheet`/`ProgrammeWeeks`,
  the calendar-icon button on `ProgrammeCard`) is retired in this plan
  (Task 7) — the new carousel replaces it. Don't leave both in place.

## Review Focus

- **A programme's session order has been changed/edited after some weeks
  were already completed** — `workoutForProgSession` must look up by
  `(programmeId, weekNum, sessionIdx)`, not by routine id, so a completed
  session's tile still shows "done" correctly even if that slot's routine
  was swapped since. Covered in Task 1.
- **Deleting a workout that has no `programmeId` (freestyle, or logged
  before this change shipped)** — the rewind logic must no-op cleanly,
  never throw on missing `weekProgress` data. Covered in Task 2.
- **The tab bar's quick-start button is tapped while `S.active` exists but
  the resolved next session's routine has since been deleted** (`ns.routine`
  is `null`) — must fall back gracefully instead of opening a confirm
  sheet for a routine that doesn't exist. Covered in Task 4.
- **A programme has more weeks than fit on screen at once** (up to 52,
  `ProgrammeEditor`'s existing max) — the carousel renders every week's
  page eagerly; must confirm this stays performant and the dot row doesn't
  overflow badly on a 320px screen. Covered in Task 6's manual check.
- **An ad-hoc session is added, then its parent programme is deleted**
  (`deleteProgramme`) — the workout record's `programmeId` now points to
  nothing; `workoutForProgSession`/the carousel must never be reached for
  a deleted programme (guarded by `activeProgramme`/programme-not-found
  checks already in place), and the orphaned workout must still render
  fine in plain history (`History.jsx`, `Heatmap.jsx`) since those don't
  key off `programmeId` at all. Covered by Task 1's absent-safe field
  design — noted here since no task adds an explicit test for it.

---

## Task 1: Link a finished workout to its programme slot

**Files:**
- Modify: `frontend/src/sheets.jsx` (`doFinishWorkout`)
- Modify: `frontend/src/lib/programme.js`
- Test: `frontend/src/lib/programme.test.js`

**Interfaces:**
- Produces: `workoutForProgSession(workouts, programmeId, weekNum,
  sessionIdx)` → the matching `S.workouts[]` entry or `null`.
- Produces on `S.workouts[]`: optional `programmeId`, `progWeek`,
  `progSessionIdx`, `adHoc` fields, copied from `S.active` at finish time.
- Consumed by: Task 2 (delete-rewind reads these fields back off the
  workout being deleted), Task 6 (carousel's done-tile lookup).

- [ ] **Step 1: Write the failing test for `workoutForProgSession`**

Add to `frontend/src/lib/programme.test.js` (extend the existing import
line with `workoutForProgSession`):

```js
import { activeProgramme, nextSession, workoutForProgSession } from './programme.js'
```

```js
describe('workoutForProgSession', () => {
  const workouts = [
    { id: 'w1', programmeId: 'p1', progWeek: 1, progSessionIdx: 0 },
    { id: 'w2', programmeId: 'p1', progWeek: 1, progSessionIdx: 1 },
    { id: 'w3', programmeId: 'p1', progWeek: 2, progSessionIdx: 0 },
    { id: 'w4' }, // freestyle workout, no programme fields at all
  ]

  it('finds the workout matching programme id, week and session index exactly', () => {
    expect(workoutForProgSession(workouts, 'p1', 1, 1)).toBe(workouts[1])
    expect(workoutForProgSession(workouts, 'p1', 2, 0)).toBe(workouts[2])
  })

  it('returns null when nothing matches, including for a freestyle workout with no programme fields', () => {
    expect(workoutForProgSession(workouts, 'p1', 3, 0)).toBe(null)
    expect(workoutForProgSession(workouts, 'p-other', 1, 0)).toBe(null)
    expect(workoutForProgSession([], 'p1', 1, 0)).toBe(null)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npm run test -- programme.test.js`
Expected: FAIL — `workoutForProgSession` is not exported.

- [ ] **Step 3: Implement `workoutForProgSession`**

Append to `frontend/src/lib/programme.js`:

```js
export function workoutForProgSession(workouts, programmeId, weekNum, sessionIdx) {
  return workouts.find(w =>
    w.programmeId === programmeId && w.progWeek === weekNum && w.progSessionIdx === sessionIdx
  ) || null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- programme.test.js`
Expected: PASS.

- [ ] **Step 5: Copy the programme-context fields onto the finished workout record**

In `frontend/src/sheets.jsx`'s `doFinishWorkout`, the record is currently
built as (around the line `const w = { id: A.id, d: A.d, start: A.start +
pausedMs, ... }`):

```js
  const w = {
    id: A.id, d: A.d, start: A.start + pausedMs, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw,
    entries: A.entries.filter(e => e.kind !== 'block').map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => (e.sets || []).some(s => s.done)),
    prs,
    ...(A.hybrid ? {
      cardioBlocks: A.entries.filter(e => e.kind === 'block' && e.done).map(e => ({
        sport: e.sport, type: e.type, duration: e.duration, distKm: e.distKm || null, kcal: e.kcal || null, notes: e.notes || null,
      }))
    } : {}),
  }
```

Add the programme-context fields, only when they exist on `A` (so a
freestyle workout gets none of them, `undefined` keys are simply absent
from the object — matches this codebase's existing convention, e.g. the
`A.hybrid ? {...} : {}` spread just above):

```js
  const w = {
    id: A.id, d: A.d, start: A.start + pausedMs, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw,
    entries: A.entries.filter(e => e.kind !== 'block').map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => (e.sets || []).some(s => s.done)),
    prs,
    ...(A.programmeId != null ? { programmeId: A.programmeId, progWeek: A.progWeek, progSessionIdx: A.progSessionIdx ?? null } : {}),
    ...(A.adHoc ? { adHoc: true } : {}),
    ...(A.hybrid ? {
      cardioBlocks: A.entries.filter(e => e.kind === 'block' && e.done).map(e => ({
        sport: e.sport, type: e.type, duration: e.duration, distKm: e.distKm || null, kcal: e.kcal || null, notes: e.notes || null,
      }))
    } : {}),
  }
```

(`progSessionIdx ?? null` rather than leaving it `undefined` when absent —
an ad-hoc session has `A.programmeId`/`A.progWeek` but no
`A.progSessionIdx`, and an explicit `null` there is what Task 6's carousel
uses to tell "ad-hoc, this programme/week" apart from "no programme
context at all".)

- [ ] **Step 6: Manual verification**

`npm run build` from `frontend/` — confirm it compiles. Full manual
verification of the fields actually reaching a real workout record happens
naturally once Task 6's carousel is wired up and testable end-to-end; this
step alone is a compile check.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/sheets.jsx frontend/src/lib/programme.js frontend/src/lib/programme.test.js
git commit -m "feat(programme): link a finished workout to its programme session"
```

---

## Task 2: Deleting a workout reopens its programme slot

**Files:**
- Modify: `frontend/src/lib/programme.js`
- Modify: `frontend/src/sheets.jsx` (`WorkoutDetail`'s delete handler)
- Test: `frontend/src/lib/programme.test.js`

**Interfaces:**
- Consumes: `S.workouts[].programmeId/.progWeek/.progSessionIdx` (Task 1).
- Produces: `rewindProgrammeForDeletedWorkout(prog, progWeek,
  progSessionIdx)` → `boolean` (whether it actually changed anything),
  mutates `prog` in place (Immer-draft-compatible, same pattern as
  `swapRoutineExerciseAt` from the previous branch).

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/lib/programme.test.js` (extend the import line with
`rewindProgrammeForDeletedWorkout`):

```js
describe('rewindProgrammeForDeletedWorkout', () => {
  it('unmarks the session and rewinds currentWeek when it had advanced past that week', () => {
    const prog = { currentWeek: 4, totalWeeks: 8, routineIds: ['a', 'b'], weekProgress: { 2: [true, true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, 2, 1)).toBe(true)
    expect(prog.weekProgress['2']).toEqual([true, false])
    expect(prog.currentWeek).toBe(2)
  })

  it('unmarks the session without touching currentWeek when the week is already current or in the future', () => {
    const prog = { currentWeek: 2, totalWeeks: 8, routineIds: ['a', 'b'], weekProgress: { 2: [true, true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, 2, 0)).toBe(true)
    expect(prog.weekProgress['2']).toEqual([false, true])
    expect(prog.currentWeek).toBe(2)
  })

  it('returns false and changes nothing for a freestyle workout (no programme fields)', () => {
    const prog = { currentWeek: 2, totalWeeks: 8, routineIds: ['a'], weekProgress: { 1: [true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, null, null)).toBe(false)
    expect(prog.weekProgress).toEqual({ 1: [true] })
    expect(prog.currentWeek).toBe(2)
  })

  it('returns false without throwing when the recorded week has no progress data at all (already-deleted programme, or stale data)', () => {
    const prog = { currentWeek: 1, totalWeeks: 8, routineIds: ['a'], weekProgress: {} }
    expect(rewindProgrammeForDeletedWorkout(prog, 5, 0)).toBe(false)
    expect(rewindProgrammeForDeletedWorkout(null, 1, 0)).toBe(false)
  })

  it('returns false for an ad-hoc workout (progSessionIdx null) — nothing to unmark', () => {
    const prog = { currentWeek: 2, totalWeeks: 8, routineIds: ['a'], weekProgress: { 2: [true] } }
    expect(rewindProgrammeForDeletedWorkout(prog, 2, null)).toBe(false)
    expect(prog.weekProgress['2']).toEqual([true])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- programme.test.js`
Expected: FAIL — `rewindProgrammeForDeletedWorkout` is not exported.

- [ ] **Step 3: Implement `rewindProgrammeForDeletedWorkout`**

Append to `frontend/src/lib/programme.js`:

```js
export function rewindProgrammeForDeletedWorkout(prog, progWeek, progSessionIdx) {
  if (!prog || progWeek == null || progSessionIdx == null) return false
  const key = String(progWeek)
  if (!prog.weekProgress || !prog.weekProgress[key] || !prog.weekProgress[key][progSessionIdx]) return false
  prog.weekProgress[key][progSessionIdx] = false
  if (prog.currentWeek > progWeek) prog.currentWeek = progWeek
  return true
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- programme.test.js`
Expected: PASS.

- [ ] **Step 5: Wire it into the delete-workout handler**

In `frontend/src/sheets.jsx`, `WorkoutDetail`'s delete button currently
reads:

```jsx
    <Button variant="danger" onClick={() => confirmSheet({ title: t('Delete workout?'), message: t('This removes it from your history for good.'), confirmText: t('Delete'), danger: true, onConfirm: () => { update(s => { s.workouts = s.workouts.filter(x => x.id !== w.id) }); close(); toast(t('Workout deleted')) } })}>{t('Delete workout')}</Button>
```

Change the `onConfirm` to also rewind the programme when applicable:

```jsx
    <Button variant="danger" onClick={() => confirmSheet({
      title: t('Delete workout?'), message: t('This removes it from your history for good.'), confirmText: t('Delete'), danger: true,
      onConfirm: () => {
        update(s => {
          s.workouts = s.workouts.filter(x => x.id !== w.id)
          if (w.programmeId != null) {
            const prog = s.programmes.find(p => p.id === w.programmeId)
            if (prog) rewindProgrammeForDeletedWorkout(prog, w.progWeek, w.progSessionIdx)
          }
        })
        close()
        toast(t('Workout deleted'))
      },
    })}>{t('Delete workout')}</Button>
```

Add `rewindProgrammeForDeletedWorkout` to `sheets.jsx`'s existing
`lib/programme.js` import line (`import { sessionStates, isWeekComplete,
isProgrammeComplete } from './lib/programme.js'`).

- [ ] **Step 6: Manual verification**

`npm run build` — confirm it compiles.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/programme.js frontend/src/lib/programme.test.js frontend/src/sheets.jsx
git commit -m "feat(programme): reopen a session's slot when its workout is deleted"
```

---

## Task 3: `confirmStartSheet` + promote `routineSubtitle` to `lib/sports.js`

**Files:**
- Modify: `frontend/src/lib/sports.js`
- Modify: `frontend/src/views/Plan.jsx`
- Modify: `frontend/src/sheets.jsx`
- Modify: `frontend/src/views/Home.jsx` (`ClassicHome`'s today-row)

**Interfaces:**
- Produces: `routineSubtitle(routine)` from `lib/sports.js` (moved, not
  new — same implementation, same behavior).
- Produces: `confirmStartSheet(routine, onConfirm)` from `sheets.jsx`.
- Consumed by: Task 4, Task 5, Task 6.

- [ ] **Step 1: Move `routineSubtitle` into `lib/sports.js`**

Remove this function from `frontend/src/views/Plan.jsx`:

```js
function routineSubtitle(r) {
  if (isCardioSport(r.sport)) {
    const min = routineTotalDuration(r.blocks || [])
    const sportLabel = t(SPORTS[r.sport]?.label || r.sport)
    return min ? `${sportLabel} \xB7 ${min} min` : sportLabel
  }
  if (isHybrid(r)) {
    const nEx = (r.items || []).filter(x => x.kind === 'ex').length
    const nBlocks = (r.items || []).filter(x => x.kind === 'block').length
    return `${exCount(nEx)} + ${nBlocks} bloc${nBlocks > 1 ? 's' : ''} cardio`
  }
  return exCount(r.ex?.length ?? 0)
}
```

Add it to `frontend/src/lib/sports.js` instead, right after `isHybrid`
(`export function isHybrid(r) { return Array.isArray(r?.items) }`):

```js
export function routineSubtitle(r) {
  if (isCardioSport(r.sport)) {
    const min = routineTotalDuration(r.blocks || [])
    const sportLabel = t(SPORTS[r.sport]?.label || r.sport)
    return min ? `${sportLabel} \xB7 ${min} min` : sportLabel
  }
  if (isHybrid(r)) {
    const nEx = (r.items || []).filter(x => x.kind === 'ex').length
    const nBlocks = (r.items || []).filter(x => x.kind === 'block').length
    return `${exCount(nEx)} + ${nBlocks} bloc${nBlocks > 1 ? 's' : ''} cardio`
  }
  return exCount(r.ex?.length ?? 0)
}
```

`lib/sports.js` already imports `t` from `./i18n.js` and `uid` from
`./format.js` — extend that second import to also bring in `exCount`:

```js
import { uid, exCount } from './format.js'
```

In `frontend/src/views/Plan.jsx`, replace the removed function with an
import: add `routineSubtitle` to the existing `lib/sports.js` import line
(`import { SPORTS, isCardioSport, defaultCardioBlocks, routineTotalDuration,
isHybrid } from '../lib/sports.js'` → extend it). Everything else in
`Plan.jsx` that calls `routineSubtitle(r)` (inside `RoutineCard` usage,
unchanged) keeps working identically.

- [ ] **Step 2: Add `confirmStartSheet` to `sheets.jsx`**

Add near `startFlowForProgramme` in `frontend/src/sheets.jsx`:

```jsx
function ConfirmStart({ routine, onConfirm, close }) {
  return <div style={{ textAlign: 'center', padding: '4px 0' }}>
    <span className="lrow-i" style={{ margin: '0 auto 10px', background: isCardioSport(routine.sport) ? 'var(--teal)' : 'var(--acc)' }}>
      <Icon name={isCardioSport(routine.sport) ? (SPORTS[routine.sport]?.icon || 'bolt') : glyphOf(routine.emoji)} />
    </span>
    <h3 style={{ marginBottom: 4 }}>{routine.name}</h3>
    <div className="muted small" style={{ marginBottom: 18 }}>{routineSubtitle(routine)}</div>
    <button className="btn primary" onClick={() => { close(); onConfirm() }}>{t('Lancer')}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" onClick={close}>{t('Annuler')}</Button>
  </div>
}
export const confirmStartSheet = (routine, onConfirm) =>
  ui().openSheet(close => <ConfirmStart routine={routine} onConfirm={onConfirm} close={close} />, { kind: 'center' })
```

Add `routineSubtitle` to `sheets.jsx`'s existing `lib/sports.js` import
line (`import { isCardioSport, isHybrid, SPORTS, BLOCK_TYPES,
blockSummary, estimateBlockKcal, defaultCardioBlocks } from
'./lib/sports.js'` → extend it).

- [ ] **Step 3: Route Home's classic-mode today-row through it**

In `frontend/src/views/Home.jsx`, `ClassicHome`'s `onToday` currently
reads:

```js
  const onToday = () => { if (S.active) nav(activeRoute); else if (routine) startFlow(routine.id); else dayOverrideSheet(todayISO()) }
```

Change the `routine` branch to confirm first:

```js
  const onToday = () => { if (S.active) nav(activeRoute); else if (routine) confirmStartSheet(routine, () => startFlow(routine.id)); else dayOverrideSheet(todayISO()) }
```

Add `confirmStartSheet` to `Home.jsx`'s existing `sheets.jsx` import line.

- [ ] **Step 4: Manual verification**

`npm run build`. With `npm run dev`, in classic mode (no active
programmes): tap the "Today" row on Home with a routine assigned — confirm
the new sheet appears (name, subtitle, Lancer/Annuler) before the session
actually starts; confirm Annuler does nothing and Lancer starts it exactly
as before. Also open `/plan` and confirm routine cards' subtitles are
unchanged (proves the moved `routineSubtitle` still works identically).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sports.js frontend/src/views/Plan.jsx frontend/src/sheets.jsx frontend/src/views/Home.jsx
git commit -m "feat(sheets): add confirmStartSheet, promote routineSubtitle to lib/sports.js"
```

---

## Task 4: Consolidate Démarrer/Pause/Reprendre into the tab bar button

**Files:**
- Modify: `frontend/src/components/TabBar.jsx`
- Modify: `frontend/src/views/Workout.jsx`

**Interfaces:**
- Consumes: `pauseWorkout()`, `resumeWorkout()` (already exported from
  `sheets.jsx`, previous branch); `confirmStartSheet` (Task 3).
- Produces: none (leaf UI); removes the standalone pause button from
  `Workout.jsx`'s header.

- [ ] **Step 1: Give the tab bar button its 3-state click behavior**

Replace `startWorkout` in `frontend/src/components/TabBar.jsx`:

```js
  const startWorkout = () => {
    if (S.active) {
      if (S.active.pausedAt) {
        resumeWorkout()
        nav(isCardioSport(S.active.sport) ? '/cardio' : '/workout')
      } else {
        pauseWorkout()
      }
      return
    }
    const prog = activeProgramme(S)
    const ns = prog && nextSession(prog, S.routines)
    if (ns && ns.routine) { confirmStartSheet(ns.routine, () => startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx)); return }
    const r = effectiveRoutine(S, todayISO())
    if (r && r.ex.length) { confirmStartSheet(r, () => onStart(r.id)); return }
    nav('/workout')
  }
```

Add `pauseWorkout, resumeWorkout, confirmStartSheet` to `TabBar.jsx`'s
existing `sheets.jsx` import line (`import { startFlowForProgramme } from
'../sheets.jsx'` → extend it).

- [ ] **Step 2: Remove the standalone pause button from Workout.jsx's header**

In `frontend/src/views/Workout.jsx`, remove this block (the pause/resume
icon button added between Discard and Finish in the previous branch):

```jsx
      <button
        className="iconbtn"
        aria-label={A.pausedAt ? t('Resume') : t('Pause')}
        onClick={() => (A.pausedAt ? resumeWorkout() : pauseWorkout())}
      >
        <Icon name={A.pausedAt ? 'play' : 'pause'} />
      </button>
```

leaving the header as Discard → title/elapsed block → Finish, same 3
children as before that button was ever added. Remove `pauseWorkout,
resumeWorkout` from `Workout.jsx`'s `sheets.jsx` import line (no longer
used there — the tab bar owns pause/resume now). Leave `Elapsed`'s
`pausedAt`/`pausedMs` props and the `elapsedMs`-based freeze logic exactly
as they are — those still work correctly no matter which button calls
`pauseWorkout`/`resumeWorkout`, since both just flip the same `S.active`
fields.

- [ ] **Step 3: Manual verification**

`npm run build`. Then, with `npm run dev`:
- No active session: tap the tab bar's Démarrer button — confirm the
  confirm-start sheet appears before anything launches.
- Confirm and start; tap the tab bar button again (now "Resume", not
  paused) — confirm it pauses in place, without navigating away from
  whatever screen you're on.
- Tap it again (now shows "En pause") — confirm it resumes and navigates
  into `/workout` (or `/cardio`), and the elapsed clock continues from
  where it froze.
- Open the workout screen's header — confirm there is no longer a separate
  pause icon there (just Discard and Finish).
- With `S.active` set but its routine deleted from the library (edge case
  from Review Focus): confirm the tab bar button still does something
  sane — it should just navigate into `/workout`/`/cardio` (the `S.active`
  branch never looks at `ns.routine` at all, so this case is naturally
  safe; verify it doesn't throw).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TabBar.jsx frontend/src/views/Workout.jsx
git commit -m "feat(tabbar): consolidate start/pause/resume into the one tab-bar button"
```

---

## Task 5: Adding a spontaneous session

**Files:**
- Modify: `frontend/src/sheets.jsx`

**Interfaces:**
- Consumes: `confirmStartSheet` (Task 3), `startFlow` (existing).
- Produces: `addAdHocSessionSheet(prog, weekNum)`, consumed by Task 6.

- [ ] **Step 1: Add the routine-picker sheet**

Add near `confirmStartSheet` in `frontend/src/sheets.jsx`, reusing the
existing routine-list-row pattern from `AddToRoutine`:

```jsx
function AddAdHocSession({ prog, weekNum, close }) {
  const st = useStore(s => s.S)
  return <>
    <h3>{t('Ajouter une séance')}</h3>
    <div className="small muted" style={{ marginBottom: 10 }}>
      {t('Semaine {0}/{1}', weekNum, prog.totalWeeks)}
    </div>
    <div className="list">
      {st.routines.map(r => (
        <div key={r.id} className="item" onClick={() => {
          close()
          confirmStartSheet(r, () => startFlow(r.id, { programmeId: prog.id, progWeek: weekNum, adHoc: true }))
        }}>
          <span className="lrow-i" style={isCardioSport(r.sport) ? { background: 'var(--teal)' } : undefined}>
            <Icon name={isCardioSport(r.sport) ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)} />
          </span>
          <div className="grow"><div className="tt">{r.name}</div><div className="ss">{routineSubtitle(r)}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>
      ))}
      {st.routines.length === 0 && <div className="empty">{t('Aucune séance dans votre bibliothèque.')}</div>}
    </div>
  </>
}
export const addAdHocSessionSheet = (prog, weekNum) =>
  ui().openSheet(close => <AddAdHocSession prog={prog} weekNum={weekNum} close={close} />)
```

Every helper this uses (`useStore`, `t`, `isCardioSport`, `SPORTS`,
`glyphOf`, `Icon`, `startFlow`, `confirmStartSheet`, `routineSubtitle`) is
already imported in `sheets.jsx` by this point in the plan (Task 3 added
`routineSubtitle`/`confirmStartSheet`; the rest predate this plan) — no new
imports needed.

- [ ] **Step 2: Manual verification**

`npm run build`. Since the carousel that hosts the "+ Ajouter une séance"
button doesn't exist until Task 6, verify this sheet directly for now by
calling it from the browser console on the dev server:
`(await import('/src/sheets.jsx')).addAdHocSessionSheet({id:'test', totalWeeks:1}, 1)`
— confirm the routine list opens, picking one opens the confirm-start
sheet, confirming calls `startFlow` (check `useStore.getState().S.active`
afterward — it should be set with `adHoc: true`). Full in-app verification
(the button actually appearing on a real week page, and the resulting
green ad-hoc tile) happens in Task 6's manual check instead, once the
carousel exists.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/sheets.jsx
git commit -m "feat(programme): add spontaneous ad-hoc session picker"
```

---

## Task 6: Swipeable weekly tile carousel on Home

**Files:**
- Modify: `frontend/src/views/Home.jsx` (replace `NextSessionCard`)

**Interfaces:**
- Consumes: `activeProgramme`, `nextSession`, `sessionStates`,
  `completedWeekCount`, `workoutForProgSession` (Task 1) from
  `lib/programme.js`; `confirmStartSheet` (Task 3); `addAdHocSessionSheet`
  (Task 5); `startFlowForProgramme`, `workoutDetailSheet` (existing).
- Produces: none new — this is the leaf consumer of everything above.

- [ ] **Step 1: Replace `NextSessionCard` with `ProgrammeWeekCarousel`**

Remove the existing `NextSessionCard` function from
`frontend/src/views/Home.jsx` (the one added in the previous branch,
`function NextSessionCard({ S, prog }) { ... }`) and replace it with:

```jsx
/* ── Swipeable per-week session carousel for the active programme ── */
function ProgrammeWeekCarousel({ S, prog }) {
  const nav = useNavigate()
  const scrollerRef = useRef(null)
  const [viewedWeek, setViewedWeek] = useState(prog.currentWeek)
  const trackedWeek = useRef(prog.currentWeek)

  // Follow prog.currentWeek's auto-advance only if the user hadn't
  // manually scrolled away from the week that just got completed.
  useEffect(() => {
    if (prog.currentWeek !== trackedWeek.current) {
      setViewedWeek(v => (v === trackedWeek.current ? prog.currentWeek : v))
      trackedWeek.current = prog.currentWeek
    }
  }, [prog.currentWeek])

  const scrollToWeek = wk => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: (wk - 1) * el.clientWidth, behavior: 'smooth' })
  }
  useEffect(() => { scrollToWeek(viewedWeek) }, [viewedWeek])

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el || !el.clientWidth) return
    const wk = Math.round(el.scrollLeft / el.clientWidth) + 1
    if (wk !== viewedWeek) setViewedWeek(wk)
  }

  const doneWeeks = completedWeekCount(prog)
  const activeRoute = S.active && isCardioSport(S.active.sport) ? '/cardio' : '/workout'

  const tileClick = (routine, weekNum, sessionIdx, state) => {
    if (state === 'done') {
      const w = workoutForProgSession(S.workouts, prog.id, weekNum, sessionIdx)
      if (w) workoutDetailSheet(w)
      return
    }
    if (S.active) { nav(activeRoute); return }
    if (!routine) return
    confirmStartSheet(routine, () => startFlowForProgramme(prog.id, weekNum, sessionIdx))
  }

  return (
    <div className="card" style={{
      border: '1.5px solid color-mix(in srgb,var(--acc) 22%,transparent)',
      background: 'color-mix(in srgb,var(--acc) 6%,var(--surface))',
      padding: '14px 0 14px 14px',
    }}>
      <div className="row between" style={{ marginBottom: 8, paddingRight: 14 }}>
        <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, color: 'var(--acc)', fontSize: 11 }}>
          {prog.name}
        </div>
        <span className="tag acc" style={{ fontSize: 10, fontWeight: 700 }}>{doneWeeks}/{prog.totalWeeks}</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {Array.from({ length: prog.totalWeeks }, (_, i) => i + 1).map(wk => {
          const states = sessionStates(prog, wk)
          const adHocThisWeek = S.workouts.filter(w => w.programmeId === prog.id && w.progWeek === wk && w.adHoc)
          return (
            <div key={wk} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', paddingRight: 14, boxSizing: 'border-box' }}>
              <div className="small muted" style={{ fontWeight: 600, marginBottom: 8 }}>
                {t('Semaine {0}/{1}', wk, prog.totalWeeks)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {prog.routineIds.map((routineId, i) => {
                  const routine = S.routines.find(r => r.id === routineId)
                  const state = states[i]
                  const color = state === 'done' ? 'var(--green)' : state === 'next' ? 'var(--yellow)' : 'var(--label-4)'
                  return (
                    <div
                      key={i}
                      className="tile colored tap"
                      style={{ '--card-color': color, width: 78, textAlign: 'center', cursor: 'pointer', padding: '10px 6px' }}
                      onClick={() => tileClick(routine, wk, i, state)}
                    >
                      <Icon name={state === 'done' ? 'check' : routine ? glyphOf(routine.emoji) : 'dumbbell'} style={{ fontSize: 17 }} />
                      <div className="small capitalize" style={{ fontWeight: 600, marginTop: 4, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {routine ? routine.name : t('Séance')}
                      </div>
                      {state === 'next' && <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2 }}>{t('Prochaine')}</div>}
                    </div>
                  )
                })}
                {adHocThisWeek.map(w => (
                  <div
                    key={w.id}
                    className="tile colored tap"
                    style={{ '--card-color': 'var(--green)', width: 78, textAlign: 'center', cursor: 'pointer', padding: '10px 6px' }}
                    onClick={() => workoutDetailSheet(w)}
                  >
                    <Icon name="check" style={{ fontSize: 17 }} />
                    <div className="small capitalize" style={{ fontWeight: 600, marginTop: 4, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.name}
                    </div>
                  </div>
                ))}
              </div>
              <button className="chip" style={{ marginTop: 10 }} onClick={() => addAdHocSessionSheet(prog, wk)}>
                {t('+ Ajouter une séance')}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10, paddingRight: 14 }}>
        {Array.from({ length: prog.totalWeeks }, (_, i) => i + 1).map(wk => (
          <button
            key={wk}
            onClick={() => setViewedWeek(wk)}
            aria-label={t('Semaine {0}', wk)}
            style={{
              width: 6, height: 6, borderRadius: '50%', border: 'none', padding: 0,
              background: wk === viewedWeek ? 'var(--acc)' : 'var(--surface-3)', flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

Add `useEffect, useRef` to `Home.jsx`'s existing `import { useState } from
'react'` line (→ `import { useEffect, useRef, useState } from 'react'`),
and add `workoutForProgSession` to the existing `lib/programme.js` import
line. `addAdHocSessionSheet` needs adding to `Home.jsx`'s existing
`sheets.jsx` import line — everything else used here (`confirmStartSheet`,
`startFlowForProgramme`, `workoutDetailSheet`, `activeProgramme`,
`nextSession`, `sessionStates`, `completedWeekCount`, `glyphOf`,
`isCardioSport`) is already imported in `Home.jsx` from earlier work.

- [ ] **Step 2: Render it in `ProgrammeHome`**

Replace the `NextSessionCard` usage in `ProgrammeHome`:

```jsx
      {(() => { const prog = activeProgramme(S); return prog ? <NextSessionCard S={S} prog={prog} /> : null })()}
```

with:

```jsx
      {(() => { const prog = activeProgramme(S); return prog ? <ProgrammeWeekCarousel S={S} prog={prog} /> : null })()}
```

- [ ] **Step 3: Manual verification**

`npm run build`. With `npm run dev`, on a demo account with an active
programme spanning several weeks:
- Confirm the outer header (name + weeks-done badge) is static while
  swiping; confirm each week page's own header reads "Semaine X/Y"
  matching the page in view.
- Swipe (or click-drag on desktop / two-finger scroll) left and right —
  confirm it snaps one week at a time, and the dot row updates to match.
- Tap a dot — confirm it scrolls straight to that week.
- Tap a green (done) tile — confirm it opens that exact workout's detail
  sheet, not some other session's.
- Tap the yellow ("Prochaine") tile — confirm the confirm-start sheet
  opens for that specific routine.
- Tap a grey tile that is *not* the suggested next one — confirm it also
  opens confirm-start (order-free), and tap one in a **future** week too —
  confirm it starts (this is the early-start behavior; there is no lock).
- At 320px width (resize the browser or use device emulation), confirm the
  tile row wraps sensibly and the dot row doesn't overflow the card — if
  it does, reduce the tile width (78px) or the dot gap (5px) until it fits;
  no CSS file changes are expected to be needed, but adjust the inline
  values above if this check fails.
- Tap "+ Ajouter une séance" on a week page — confirm the picker from
  Task 5 opens, and completing it produces a green ad-hoc tile on that
  same week without flipping any fixed-slot tile or advancing the week.
- Finish every fixed-slot session in a week from the carousel — confirm
  the view auto-advances to the next week once the last tile turns green.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "feat(home): replace next-session card with a swipeable weekly tile carousel"
```

---

## Task 7: Retire the read-only week browser

**Files:**
- Modify: `frontend/src/components/ProgrammeCard.jsx`
- Modify: `frontend/src/sheets.jsx` (remove `ProgrammeWeeks`/`programmeWeeksSheet`)

**Interfaces:** none — pure removal, superseded by Task 6's carousel.

- [ ] **Step 1: Remove the calendar-icon button from `ProgrammeCard`**

In `frontend/src/components/ProgrammeCard.jsx`, remove this whole block
(added in the previous branch, sits between the status badge and the
delete button):

```jsx
      {/* Weeks browser button */}
      <button
        className="iconbtn"
        style={{
          position: 'absolute', top: 5, right: 46,
          width: 36, height: 36, fontSize: 13,
          color: hasImg ? 'rgba(255,255,255,0.85)' : 'var(--label-3)',
          background: hasImg ? 'rgba(0,0,0,0.35)' : 'transparent',
          borderRadius: 8,
        }}
        aria-label={t('View weeks')}
        onClick={e => { e.stopPropagation(); programmeWeeksSheet(prog) }}
      >
        <Icon name="calendar" />
      </button>
```

Remove `programmeWeeksSheet` from the `sheets.jsx` import line at the top
of the file (`import { programmeEditSheet, programmeWeeksSheet,
deleteProgramme } from '../sheets.jsx'` → drop it, keeping the other two).

- [ ] **Step 2: Remove `ProgrammeWeeks`/`programmeWeeksSheet` from `sheets.jsx`**

Delete the whole `function ProgrammeWeeks({ prog, close }) { ... }`
component and its `export const programmeWeeksSheet = prog => ...` line
from `frontend/src/sheets.jsx` (sits right after `programmeEditSheet`,
before `deleteProgramme`).

- [ ] **Step 3: Manual verification**

`npm run build` — confirm it compiles with no leftover references. On
`/plan`, confirm each programme card shows only its delete (trash) button
in the top-right now, no calendar icon; confirm tapping the card body
still opens the edit sheet as before (Task 8 changes that further, but
this task alone shouldn't touch that click behavior).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProgrammeCard.jsx frontend/src/sheets.jsx
git commit -m "refactor(programme): retire the read-only week browser, superseded by the Home carousel"
```

---

## Task 8: Programme card navigates to Plan before opening edit

**Files:**
- Modify: `frontend/src/components/ProgrammeCard.jsx`

**Interfaces:** none — leaf UI change.

- [ ] **Step 1: Navigate to `/plan` before opening the edit sheet**

`ProgrammeCard`'s root `onClick` currently reads:

```jsx
    <div
      onClick={() => programmeEditSheet(prog)}
```

Change it to navigate first when not already on `/plan`:

```jsx
    <div
      onClick={() => { if (loc.pathname !== '/plan') nav('/plan'); programmeEditSheet(prog) }}
```

Add the hooks this needs at the top of the component (`ProgrammeCard` is
currently a plain function taking `{ prog }` with no hooks at all):

```js
import { useLocation, useNavigate } from 'react-router-dom'
```

```js
export default function ProgrammeCard({ prog }) {
  const nav = useNavigate()
  const loc = useLocation()
  const complete = isProgrammeComplete(prog)
  // ...rest unchanged
```

- [ ] **Step 2: Manual verification**

`npm run build`. With `npm run dev`: from Home's programme grid, tap a
programme card — confirm it navigates to `/plan` *and* the edit sheet
opens on top. From `/plan` itself, tap a programme card — confirm it opens
the edit sheet without a visible navigation flicker (already on the same
route).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProgrammeCard.jsx
git commit -m "feat(programme): tapping a programme card from Home routes through Plan"
```

---

## Task 9: Plan screen — programme-first layout

**Files:**
- Modify: `frontend/src/views/Plan.jsx`

**Interfaces:** none — leaf UI change.

- [ ] **Step 1: Add a local toggle state and collapse the classic grid**

In `frontend/src/views/Plan.jsx`, add `useState` to the existing React
import (`import { useNavigate } from 'react-router-dom'` stays; add a new
line `import { useState } from 'react'`), and inside `Plan()`:

```js
  const [showClassic, setShowClassic] = useState(false)
```

Wrap the existing "Week schedule" section — currently:

```jsx
    {/* ── Week schedule grid ── */}
    <div data-tuto="plan-week" style={{ marginBottom: 24 }}>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {/* ...unchanged day cells... */}
      </div>
    </div>
```

so that when `programmes.length > 0`, it renders behind a toggle instead
of always-expanded:

```jsx
    {/* ── Week schedule grid (collapsed behind a toggle once programmes exist) ── */}
    {programmes.length > 0 && !showClassic ? (
      <div style={{ marginBottom: 24 }}>
        <button className="chip" onClick={() => setShowClassic(true)}>
          {t('Voir le planning classique')}
        </button>
      </div>
    ) : (
      <div data-tuto="plan-week" style={{ marginBottom: 24 }}>
        <div className="row between" style={{ marginBottom: 4 }}>
          <h4 className="sec" style={{ margin: 0 }}>{t('Week schedule')}</h4>
          {programmes.length > 0 && (
            <button className="chip" style={{ fontSize: 12 }} onClick={() => setShowClassic(false)}>
              {t('Masquer')}
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {/* ...unchanged day cells, exact same content as today... */}
        </div>
      </div>
    )}
```

(Only the wrapping changes — the day-cell grid's own JSX, the `[1,2,3,4,5,6,0].map(d
=> ...)` block, is copied over untouched into the `else` branch; nothing
inside it changes.) When there are no programmes at all
(`programmes.length === 0`), the grid always renders expanded with no
toggle button — matches today's behavior exactly for a classic-only user.

- [ ] **Step 2: Rename the Routines section header**

Change:

```jsx
        <h4 className="sec" style={{ margin: 0 }}>{t('Entrainements / Séances')}</h4>
```

to:

```jsx
        <h4 className="sec" style={{ margin: 0 }}>{t('Bibliothèque de séances')}</h4>
```

- [ ] **Step 3: Manual verification**

`npm run build`. With `npm run dev`:
- Account with an active programme: open `/plan` — confirm the week
  schedule grid is collapsed behind "Voir le planning classique"; tap it —
  confirm the grid expands with a "Masquer" button that collapses it
  again.
- Account with no programmes at all: confirm the week schedule grid is
  expanded by default, exactly as before this task, with no toggle
  visible.
- Confirm the routines section now reads "Bibliothèque de séances".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Plan.jsx
git commit -m "feat(plan): lead with programmes, collapse the classic weekly grid behind a toggle"
```

---

## Final check (after all 9 tasks)

- [ ] `npm run test` from `frontend/` — confirm every existing test plus
  the new `programme.test.js` cases (Tasks 1, 2) pass.
- [ ] `npm run build` from `frontend/` — confirm the production build
  succeeds with no stray unused imports (`ProgrammeWeeks`,
  `programmeWeeksSheet`, and the old `NextSessionCard` should all be fully
  gone, not just unreferenced).
- [ ] `npm run dev`, walk every numbered spec section end-to-end once more
  in the running app, including the Review Focus scenarios above.
