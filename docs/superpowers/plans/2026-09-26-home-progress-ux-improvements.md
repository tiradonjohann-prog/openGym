# Home / Progress / UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 8 approved UX fixes for OpenGym Sasoian — programme-aware
"next session" on Home, per-programme progress display, an explicit
once/always choice on exercise swap, a restricted beginner mode, a real
workout pause, similar-exercise shortcuts, three 3D-view/exercise-list bug
fixes, and a read-only programme week browser.

**Architecture:** All changes are additive to the existing React (JSX) +
Zustand (`useStore`) frontend in `frontend/src/`. New pure logic (programme
progression, elapsed-time math) goes into `frontend/src/lib/*.js` and is
covered by Vitest — the project's existing convention (every `lib/*.js` file
with non-trivial logic has a sibling `*.test.js`; view/component files do
not, except one intentionally-unit-tested helper in `AnatomyView.jsx`). UI
changes reuse existing components (`sheets.jsx`'s sheet system, `ui.jsx`
primitives) and existing store mutation patterns (`update(s => {...})`).

**Tech Stack:** React 19 (JSX, no TypeScript), Zustand store (`useStore.js`),
Vitest for unit tests, Vite dev server for manual verification.

**Spec:** `docs/superpowers/specs/2026-09-26-home-progress-ux-improvements-design.md`

## Global Constraints

- No TypeScript in this codebase — plain JSX/JS, matching every existing file.
- Only `lib/*.js` pure logic gets automated tests here (Vitest,
  `npm run test` from `frontend/`); view/sheet/component changes are
  verified manually via `npm run dev`, per this codebase's existing pattern.
- Store mutations always go through `update(s => { ... })` (Immer-style
  draft mutation) from `useStore.js` — never assign to `S()` directly.
- Never touch `S.routines` or `S.programmes` shape in a way that breaks
  existing saved data — every new field on `S.active` must be optional/
  absent-safe (matches this store's existing convention for `hybrid`,
  `sport`, etc.).
- Add/remove-set stays session-only, no prompt — do not add a scope choice
  there (explicitly ruled out by the user during design).
- Keep simplified-mode changes confined to `Home.jsx` and `Workout.jsx` —
  no other view may branch on `S.simpleMode` in this plan.
- All commits happen on branch `feature/home-progress-ux-improvements`
  (already created and checked out).

## Review Focus

- **Freestyle workout (no `routineId`) hits the exercise-swap flow** — the
  scope-choice dialog must not appear; swap must behave exactly as today
  (session-only, no picker). Covered in Task 4.
- **A workout is paused and the user finishes it or discards it without
  resuming first** — finishing must fold the open pause into the recorded
  duration instead of leaving it uncounted or crashing; discarding while
  paused must not leave stray timers running. Covered in Task 6 and Task 7.
- **A programme is paused or fully complete** — `activeProgramme`/
  `nextSession` must return `null` rather than surfacing a stale or
  impossible "next session" card, and `TabBar`/Home must fall back
  gracefully (today's classic-plan routine, or the plain workout picker).
  Covered in Task 1, Task 2, Task 3.
- **Exercise has zero similar candidates** (unusual body part / equipment
  combo) — the similar-exercises row in `ExerciseDetail` must render nothing
  rather than an empty/broken row. Covered in Task 8.
- **Muscle with ≤30 exercises in the 3D view** — the "Charger plus" button
  must not appear, and the existing "{0} exercises target this muscle" copy
  (no "top N of M" framing) must still be used. Covered in Task 10.

---

## Task 1: Programme progression helpers (`activeProgramme`, `nextSession`)

**Files:**
- Modify: `frontend/src/lib/programme.js`
- Test: `frontend/src/lib/programme.test.js` (new)

**Interfaces:**
- Consumes: `isProgrammeComplete(prog)`, `nextSessionIdx(prog, weekNum)`
  (both already exist in this file, unchanged).
- Produces:
  - `activeProgramme(S)` → the first programme in `S.programmes` that is
    neither `paused` nor complete, or `null`.
  - `nextSession(prog, routines)` → `{ routineId, weekNum, sessionIdx,
    routine } | null` — `routine` is the matching entry from `routines`
    (the `S.routines` array) or `null` if not found.

Both are pure functions: no store imports, no side effects, matching every
other export in this file.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/programme.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { activeProgramme, nextSession } from './programme.js'

const routine = (id, name = id) => ({ id, name, ex: [] })

describe('activeProgramme', () => {
  it('returns null when there are no programmes', () => {
    expect(activeProgramme({ programmes: [] })).toBe(null)
    expect(activeProgramme({})).toBe(null)
  })

  it('skips paused and complete programmes, returns the first eligible one', () => {
    const paused = { id: 'a', paused: true, totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }
    const complete = { id: 'b', totalWeeks: 1, routineIds: ['r1'], weekProgress: { 1: [true] } }
    const active = { id: 'c', totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }
    expect(activeProgramme({ programmes: [paused, complete, active] })).toBe(active)
  })

  it('returns null when every programme is paused or complete', () => {
    const paused = { id: 'a', paused: true, totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }
    const complete = { id: 'b', totalWeeks: 1, routineIds: ['r1'], weekProgress: { 1: [true] } }
    expect(activeProgramme({ programmes: [paused, complete] })).toBe(null)
  })
})

describe('nextSession', () => {
  it('returns null for a null/paused/complete programme', () => {
    expect(nextSession(null, [])).toBe(null)
    expect(nextSession({ paused: true, totalWeeks: 4, routineIds: ['r1'], weekProgress: {} }, [])).toBe(null)
    const complete = { totalWeeks: 1, routineIds: ['r1'], weekProgress: { 1: [true] } }
    expect(nextSession(complete, [])).toBe(null)
  })

  it('resolves the next session in the current week, with its routine', () => {
    const prog = { currentWeek: 2, totalWeeks: 4, routineIds: ['push', 'pull'], weekProgress: { 2: [true, false] } }
    const routines = [routine('push'), routine('pull', 'Pull day')]
    expect(nextSession(prog, routines)).toEqual({
      routineId: 'pull', weekNum: 2, sessionIdx: 1, routine: routines[1],
    })
  })

  it('falls through to a later week when the recorded current week is already fully done', () => {
    // currentWeek not yet advanced by finishWorkout(), but week 2 is actually complete
    const prog = { currentWeek: 2, totalWeeks: 3, routineIds: ['push'], weekProgress: { 2: [true] } }
    const routines = [routine('push')]
    expect(nextSession(prog, routines)).toEqual({
      routineId: 'push', weekNum: 3, sessionIdx: 0, routine: routines[0],
    })
  })

  it('returns routine: null when the routine id no longer exists', () => {
    const prog = { currentWeek: 1, totalWeeks: 1, routineIds: ['gone'], weekProgress: {} }
    expect(nextSession(prog, [])).toEqual({
      routineId: 'gone', weekNum: 1, sessionIdx: 0, routine: null,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `npm run test -- programme.test.js`
Expected: FAIL — `activeProgramme` and `nextSession` are not exported yet.

- [ ] **Step 3: Implement the helpers**

Append to `frontend/src/lib/programme.js`:

```js
export function activeProgramme(S) {
  const list = S.programmes || []
  return list.find(p => !p.paused && !isProgrammeComplete(p)) || null
}

export function nextSession(prog, routines) {
  if (!prog || prog.paused || isProgrammeComplete(prog)) return null
  for (let week = prog.currentWeek; week <= prog.totalWeeks; week++) {
    const sessionIdx = nextSessionIdx(prog, week)
    if (sessionIdx === -1) continue
    const routineId = prog.routineIds[sessionIdx]
    return {
      routineId,
      weekNum: week,
      sessionIdx,
      routine: routines.find(r => r.id === routineId) || null,
    }
  }
  return null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- programme.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/programme.js frontend/src/lib/programme.test.js
git commit -m "feat(programme): add activeProgramme and nextSession helpers"
```

---

## Task 2: "Next session" + progress card on Home (programme mode)

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `activeProgramme(S)`, `nextSession(prog, routines)` from
  `lib/programme.js` (Task 1); `completedWeekCount(prog)` (already exists in
  `lib/programme.js`); `startFlowForProgramme(programmeId, weekNum,
  sessionIdx)` and `glyphOf` (already imported/exist).
- Produces: no new exports — this is a leaf UI change inside `ProgrammeHome`.

- [ ] **Step 1: Import the new helpers**

In `frontend/src/views/Home.jsx`, add to the existing imports:

```js
import { activeProgramme, nextSession, completedWeekCount } from '../lib/programme.js'
import { startFlowForProgramme } from '../sheets.jsx'
```

(`startFlowForProgramme` isn't in the current `sheets.jsx` import line on
Home.jsx — add it there; everything else it needs, e.g. `startFlow`, stays.)

- [ ] **Step 2: Add the NextSessionCard component**

Add above `ProgrammeHome` in `frontend/src/views/Home.jsx`:

```jsx
function NextSessionCard({ S, prog }) {
  const ns = nextSession(prog, S.routines)
  if (!ns) return null
  const activeRoute = S.active && isCardioSport(S.active.sport) ? '/cardio' : '/workout'
  const nav = useNavigate()
  const doneWeeks = completedWeekCount(prog)
  const onClick = () => {
    if (S.active) { nav(activeRoute); return }
    startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx)
  }
  return (
    <div className="card tap" onClick={onClick} style={{
      border: '1.5px solid color-mix(in srgb,var(--acc) 22%,transparent)',
      background: 'color-mix(in srgb,var(--acc) 6%,var(--surface))',
    }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, color: 'var(--acc)', fontSize: 11 }}>
          {prog.name} · {t('Semaine {0}/{1}', ns.weekNum, prog.totalWeeks)}
        </div>
        <span className="tag acc" style={{ fontSize: 10, fontWeight: 700 }}>{doneWeeks}/{prog.totalWeeks}</span>
      </div>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : 'var(--acc)' }}>
          <Icon name={S.active ? 'timer' : ns.routine ? glyphOf(ns.routine.emoji) : 'dumbbell'} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="lbl2">{t('Prochaine séance')}</div>
          <div className="ttl">{ns.routine ? ns.routine.name : t('Séance')}</div>
        </div>
        <span className="tag resume pop">{S.active ? t('Resume') : t('Start')}</span>
      </div>
    </div>
  )
}
```

`isCardioSport` and `useNavigate` are already imported at the top of
`Home.jsx` — no new import needed for those two.

- [ ] **Step 3: Render it inside ProgrammeHome**

In `ProgrammeHome` (`frontend/src/views/Home.jsx`), right after the
programmes grid `</div>` and before `<SmartNudge S={S} />` (currently line
~276), add:

```jsx
      {(() => { const prog = activeProgramme(S); return prog ? <NextSessionCard S={S} prog={prog} /> : null })()}

      <SmartNudge S={S} />
```

- [ ] **Step 4: Manual verification**

Run `npm run dev` from `frontend/`. With a demo account that has at least
one active (non-paused, non-complete) programme:
- Confirm the "Prochaine séance" card renders above "Last workout", showing
  the right routine name and week counter.
- Tap it — confirm it launches that exact session (or resumes the active
  one, if a workout is already in progress).
- Pause the programme (via `ProgrammeEditor`'s pause toggle) — confirm the
  card disappears.
- Complete every session in every week of a short (1-2 week) test
  programme — confirm the card disappears once the programme is complete.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "feat(home): add clickable next-session card for programme mode"
```

---

## Task 3: Programme-aware "Démarrer" (TabBar)

**Files:**
- Modify: `frontend/src/components/TabBar.jsx`

**Interfaces:**
- Consumes: `activeProgramme(S)`, `nextSession(prog, routines)` (Task 1);
  `startFlowForProgramme` (from `sheets.jsx`, currently unused —
  already exported); `isCardioSport` (from `lib/sports.js`).
- Produces: none (leaf change).

- [ ] **Step 1: Update imports in TabBar.jsx**

```js
import { effectiveRoutine } from '../lib/history.js'
import { activeProgramme, nextSession } from '../lib/programme.js'
import { isCardioSport } from '../lib/sports.js'
import { startFlowForProgramme } from '../sheets.jsx'
import { todayISO } from '../lib/format.js'
```

(`effectiveRoutine` and `todayISO` are already imported today — keep them;
add the three new ones.)

- [ ] **Step 2: Rewrite `startWorkout`**

Replace the current `startWorkout` function in `TabBar.jsx`:

```js
  const startWorkout = () => {
    if (S.active) {
      nav(isCardioSport(S.active.sport) ? '/cardio' : '/workout')
      return
    }
    const prog = activeProgramme(S)
    const ns = prog && nextSession(prog, S.routines)
    if (ns) { startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx); return }
    const r = effectiveRoutine(S, todayISO())
    if (r && r.ex.length) { onStart(r.id); return }
    nav('/workout')
  }
```

Note: this also fixes a pre-existing gap where resuming an active *cardio*
session from the tab bar always navigated to `/workout` instead of
`/cardio` — a one-line correctness fix directly adjacent to what this task
already touches, not a separate feature.

- [ ] **Step 3: Manual verification**

With `npm run dev`:
- No active programme, no active workout, today has a classic-plan routine
  → tapping "Démarrer" starts that routine (unchanged behavior).
- Active programme, no workout in progress → tapping "Démarrer" starts the
  programme's next session, regardless of day-of-week plan.
- Workout in progress (strength) → "Démarrer" becomes "Resume", tapping it
  opens `/workout`.
- Workout in progress (cardio, e.g. start a Running session) → "Démarrer"
  becomes "Resume", tapping it opens `/cardio` (previously opened
  `/workout`, confirm this is now fixed).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TabBar.jsx
git commit -m "feat(tabbar): prioritize programme next-session over day-of-week plan"
```

---

## Task 4: Per-programme progress block on Home

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `activeProgramme`, same `nextSession`/`completedWeekCount` from
  Task 1/2 (already imported by Task 2).
- Produces: none.

This is folded into the `NextSessionCard` from Task 2 rather than a second
card (per spec §2 — avoid two cards saying similar things). The week
counter (`Semaine {ns.weekNum}/{prog.totalWeeks}`) and the completed-weeks
badge (`{doneWeeks}/{prog.totalWeeks}`) already added in Task 2 Step 2 are
the entire deliverable for this task. This task only adds the **sessions
done this week** line, which needs `sessionStates`.

- [ ] **Step 1: Import `sessionStates`**

Add to the `lib/programme.js` import line in `Home.jsx` (from Task 2 Step
1): `sessionStates`.

```js
import { activeProgramme, nextSession, completedWeekCount, sessionStates } from '../lib/programme.js'
```

- [ ] **Step 2: Add the this-week line to `NextSessionCard`**

Inside `NextSessionCard` (Task 2), after computing `doneWeeks`, add:

```js
  const weekStates = sessionStates(prog, ns.weekNum)
  const doneThisWeek = weekStates.filter(s => s === 'done').length
```

And render it as a small line under the header row (inside the outer
`<div className="card tap" ...>`, after the `row between` header block,
before the `row` with the icon/title):

```jsx
      <div className="small muted" style={{ marginBottom: 8 }}>
        {t('{0}/{1} séances cette semaine', doneThisWeek, weekStates.length)}
      </div>
```

- [ ] **Step 3: Manual verification**

With a programme where 1 of 3 sessions this week is done: confirm the card
shows "1/3 séances cette semaine" and the week counter/badge from Task 2
both still read correctly.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "feat(home): show sessions-done-this-week on the programme progress card"
```

---

## Task 5: Exercise swap — once vs. always scope choice

**Files:**
- Modify: `frontend/src/sheets.jsx`
- Modify: `frontend/src/views/Workout.jsx`

**Interfaces:**
- Consumes: existing `SwapPicker`/`swapExerciseSheet` (in `sheets.jsx`),
  existing `update`/`S` module-level helpers in `sheets.jsx`.
- Produces: `swapExerciseSheet(currentExId, onSwap, routineId = null)` —
  third parameter added, backward compatible (existing 2-arg call sites
  keep working unchanged; only `Workout.jsx`'s two call sites are updated to
  pass it).

- [ ] **Step 1: Add the scope-choice dialog to `sheets.jsx`**

Add near `SwapPicker` (after its closing `}` / before
`export const swapExerciseSheet`):

```jsx
function SwapScopeDialog({ newEx, current, routineId, onSwap, close }) {
  const applyAlways = () => {
    update(s => {
      const r = s.routines.find(x => x.id === routineId)
      if (!r) return
      if (r.items) {
        const item = r.items.find(x => x.kind === 'ex' && x.id === current.id)
        if (item) item.id = newEx.id
      } else if (r.ex) {
        const item = r.ex.find(x => x.id === current.id)
        if (item) item.id = newEx.id
      }
    })
    close()
    onSwap(newEx)
  }
  const applyOnce = () => { close(); onSwap(newEx) }
  return <div style={{ textAlign: 'center', padding: '4px 0' }}>
    <h3 style={{ marginBottom: 8 }}>{t('Remplacer "{0}" par "{1}"', current.n, newEx.n)}</h3>
    <div className="muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>
      {t('Ce changement s\'applique-t-il seulement à cette séance, ou à toutes les prochaines séances de cette routine ?')}
    </div>
    <button className="btn primary" onClick={applyAlways}>{t('Toutes les prochaines séances')}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" onClick={applyOnce}>{t('Cette séance seulement')}</Button>
  </div>
}
```

`current` is the already-resolved exercise object — the caller (`SwapPicker`,
Step 2 below) passes its own `current` (it already resolves
`EXDB[currentExId] || allExercises(st).find(...)` for its own header), so
this dialog stays a pure renderer with no lookup logic of its own.

- [ ] **Step 2: Wire the dialog into `swapExerciseSheet`**

Replace the existing `SwapPicker` component's `onSwap` handling and the
exported `swapExerciseSheet` function:

```jsx
function SwapPicker({ currentExId, onSwap, routineId, close }) {
  const st = useStore(s => s.S)
  const current = EXDB[currentExId] || allExercises(st).find(e => e.id === currentExId) || { n: currentExId, bp: '', eq: '' }
  const all = allExercises(st).filter(e => e.id !== currentExId)
  const similar = all
    .map(e => ({ ...e, score: (e.bp && e.bp === current.bp ? 10 : 0) + (e.eq && e.eq === current.eq ? 5 : 0) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
  const pick = newEx => {
    if (!routineId) { close(); onSwap(newEx); return }
    close()
    ui().openSheet(closeScope => (
      <SwapScopeDialog newEx={newEx} current={current} routineId={routineId} onSwap={onSwap} close={closeScope} />
    ), { kind: 'center' })
  }
  const showAll = () => { close(); exercisePicker(newEx => pick(newEx)) }
  return <>
    <h3>{t('Switch exercise')}</h3>
    <div className="small muted" style={{ marginBottom: 10 }}>
      {t('Replacing')}: <span className="capitalize" style={{ fontWeight: 500 }}>{current.n}</span>
    </div>
    {similar.length === 0 && <div className="empty" style={{ margin: '10px 0' }}>{t('No similar exercises found.')}</div>}
    <div className="list">
      {similar.slice(0, 20).map(e => (
        <div key={e.id} className="item" onClick={() => pick(e)}>
          <Thumb ex={e} />
          <div className="grow">
            <div className="tt capitalize">{e.n}</div>
            <div className="ss capitalize">{e.tg ? muscleLabel(e.tg) : bodyPartLabel(e.bp)} · {equipmentLabel(e.eq)}</div>
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      ))}
    </div>
    <div style={{ height: 10 }} />
    <Button icon="list" onClick={showAll}>{t('Browse all exercises')}</Button>
  </>
}
export const swapExerciseSheet = (currentExId, onSwap, routineId = null) =>
  ui().openSheet(close => <SwapPicker currentExId={currentExId} onSwap={onSwap} routineId={routineId} close={close} />)
```

(This changes `showAll`'s inline picker callback from `newEx => onSwap(newEx)`
to `newEx => pick(newEx)` so browsing the full list also goes through the
scope choice when a `routineId` is present.)

- [ ] **Step 3: Pass `routineId` from `Workout.jsx`**

The actual `swapExerciseSheet(...)` call is inside `ExerciseBlock`
(`frontend/src/views/Workout.jsx`, around line 340:
`onClick={() => swapExerciseSheet(entry.id, onSwap)}`) — `onSwap` itself is
defined and passed down as a prop from the two `<ExerciseBlock ... />`
usages further down (around lines 605 and 613). Thread a `routineId` prop
the same way:

```jsx
// ExerciseBlock signature — add routineId:
function ExerciseBlock({ entryIdx, compact, onToggle, onField, onAddSet, onRemoveSet, onStartTimed, onSwap, routineId }) {
  ...
  {onSwap && <button className="iconbtn" aria-label={t('Switch exercise')} onClick={() => swapExerciseSheet(entry.id, onSwap, routineId)}><Icon name="shuffle" /></button>}
```

And at both `<ExerciseBlock ... />` usages, add `routineId={A.routineId}` as
a prop (leave every other existing prop on those two elements — `onToggle`,
`onField`, `onAddSet`, `onRemoveSet`, `onStartTimed`, `onSwap` — unchanged).
Each `onSwap` callback already only mutates `s.active.entries[...]`, which
is correct for both scope choices: the dialog itself handles persisting to
`S.routines` separately when "always" is picked, while the active session's
`onSwap` mutation must fire either way so the in-progress session reflects
the pick immediately.

- [ ] **Step 4: Manual verification**

- Routine-backed session: swap an exercise, pick "Cette séance seulement" —
  confirm only the current session changes (check `Plan` → that routine
  still shows the old exercise).
- Same, pick "Toutes les prochaines séances" — confirm the routine itself
  now shows the new exercise in `Plan`, and starting a fresh session of that
  routine starts with the new exercise.
- Freestyle workout (`startFlow(null)`) — confirm swapping an exercise skips
  the scope dialog entirely (no `routineId`, `S.active.routineId` is
  `null`), exactly like today.
- "Browse all exercises" path — confirm it also triggers the scope dialog
  when inside a routine-backed session.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/sheets.jsx frontend/src/views/Workout.jsx
git commit -m "feat(workout): ask once-vs-always scope when swapping an exercise"
```

---

## Task 6: Real pause — data model + duration math

**Files:**
- Modify: `frontend/src/lib/history.js`
- Test: `frontend/src/lib/history.test.js`
- Modify: `frontend/src/sheets.jsx`

**Interfaces:**
- Produces: `elapsedMs(active, now = Date.now())` in `lib/history.js` — pure
  function, `active` is any object with `{ start, pausedAt, pausedMs }`
  (all optional except `start`).
- Produces: `pauseWorkout()`, `resumeWorkout()` exported from `sheets.jsx`.
- Consumed by: Task 7 (`Elapsed` component, pause button).

- [ ] **Step 1: Write the failing test for `elapsedMs`**

Add to `frontend/src/lib/history.test.js` (new `describe` block, anywhere
after the existing imports — add `elapsedMs` to the existing import line):

```js
import { modeOf, isTimed, fmtSec, setLabel, defaultConfig, buildSets, exLine, workoutVolume, effortOf, stepEffort, capEffort, isBw, isPerSide, sideReps, repStep, elapsedMs } from './history.js'
```

```js
describe('elapsedMs', () => {
  const start = 1_000_000

  it('counts straight through when never paused', () => {
    expect(elapsedMs({ start }, start + 5000)).toBe(5000)
  })

  it('freezes at the moment it was paused', () => {
    const active = { start, pausedAt: start + 3000, pausedMs: 0 }
    expect(elapsedMs(active, start + 9000)).toBe(3000)
  })

  it('excludes a completed pause once resumed', () => {
    // paused for 2000ms total, then 4000ms more of real time passed
    const active = { start, pausedAt: null, pausedMs: 2000 }
    expect(elapsedMs(active, start + 2000 + 4000)).toBe(4000)
  })

  it('treats missing pausedAt/pausedMs as zero (backward compatible with old S.active shapes)', () => {
    expect(elapsedMs({ start }, start + 1000)).toBe(1000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- history.test.js`
Expected: FAIL — `elapsedMs` is not exported.

- [ ] **Step 3: Implement `elapsedMs`**

Add to `frontend/src/lib/history.js`, near `buildSets` (any top-level
location is fine — this file exports many independent pure helpers):

```js
// Wall-clock elapsed time for an active session, excluding paused spans.
// `active.pausedAt` (timestamp | null) marks an open pause; `active.pausedMs`
// accumulates every *closed* pause. Works whether currently paused or not.
export function elapsedMs(active, now = Date.now()) {
  const pausedMs = active.pausedMs || 0
  const clockNow = active.pausedAt || now
  return clockNow - active.start - pausedMs
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- history.test.js`
Expected: PASS (all `elapsedMs` cases + every pre-existing test in the file).

- [ ] **Step 5: Add `pauseWorkout`/`resumeWorkout` to `sheets.jsx`**

Add next to `finishWorkout` in `frontend/src/sheets.jsx`:

```js
export function pauseWorkout() {
  update(s => { if (s.active && !s.active.pausedAt) s.active.pausedAt = Date.now() })
}
export function resumeWorkout() {
  update(s => {
    if (s.active && s.active.pausedAt) {
      s.active.pausedMs = (s.active.pausedMs || 0) + (Date.now() - s.active.pausedAt)
      s.active.pausedAt = null
    }
  })
}
```

- [ ] **Step 6: Fold pause time into recorded workout duration on finish**

The workout record is actually built in `doFinishWorkout()` (the internal
function `finishWorkout()` calls after its confirmation prompts), which
re-reads `const A = st.active` and builds
`const w = { id: A.id, d: A.d, start: A.start, end: Date.now(), routineId:
A.routineId, ... }` (`frontend/src/sheets.jsx`, currently around line
1515-1516). Insert this line immediately before `const w = {`:

```js
  const pausedMs = A.pausedAt ? (A.pausedMs || 0) + (Date.now() - A.pausedAt) : (A.pausedMs || 0)
```

and change only the record's `start` field from `A.start` to
`A.start + pausedMs` (every other field on `w` — `end: Date.now()`, `d:
A.d`, `routineId`, etc. — stays exactly as it is today). This keeps every
existing `w.end - w.start` duration consumer
(`Home.jsx`'s last-workout card, `Heatmap.jsx`, `Admin.jsx`, `Stats.jsx`,
the workout-detail sheet's Duration tile, the kcal estimate) correct without
touching any of those call sites — they all already compute duration as
`end - start`, so shifting `start` forward by the paused time is the only
change needed. (`w.start` is also used as a chart x-axis timestamp in
`Stats.jsx`/`onerm.js` for a handful of pixels' worth of skew equal to the
pause length — an accepted, documented tradeoff, not a bug.)

- [ ] **Step 7: Manual verification**

Not yet wired to UI (Task 7 does that) — verify via the browser console on
the dev server: start a workout, run
`useStore.getState().update(s => { s.active.pausedAt = Date.now() - 5000 })`
then call `useStore.getState().S.active` and confirm `pausedAt` is set;
finish the workout and confirm the saved workout's `end - start` is
~5 seconds shorter than the wall-clock session length.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/history.js frontend/src/lib/history.test.js frontend/src/sheets.jsx
git commit -m "feat(workout): add pause/resume state and pause-aware duration math"
```

---

## Task 7: Real pause — UI (workout screen, TabBar, Home)

**Files:**
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/components/TabBar.jsx`
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `elapsedMs` (Task 6), `pauseWorkout`/`resumeWorkout` (Task 6).
- Produces: none (leaf UI).

- [ ] **Step 1: Update `Elapsed` to use `elapsedMs` and freeze while paused**

Replace `Elapsed` in `frontend/src/views/Workout.jsx`:

```jsx
function Elapsed({ start, pausedAt, pausedMs }) {
  const [txt, setTxt] = useState('0:00')
  useEffect(() => {
    const tick = () => {
      const ms = elapsedMs({ start, pausedAt, pausedMs })
      const s = Math.max(0, Math.floor(ms / 1000))
      setTxt(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'))
    }
    tick()
    if (pausedAt) return // frozen — no ticking interval needed
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [start, pausedAt, pausedMs])
  return <span>{txt}</span>
}
```

Add `elapsedMs` to `Workout.jsx`'s existing import from `../lib/history.js`
(check the top of the file for that import line and extend it — every other
helper listed there stays untouched).

Update the call site (`<Elapsed start={A.start} />`, in the header) to:

```jsx
<Elapsed start={A.start} pausedAt={A.pausedAt} pausedMs={A.pausedMs} />
```

- [ ] **Step 2: Add the Pause/Resume button to the workout header**

The header (`frontend/src/views/Workout.jsx`, the `<div className="hdr">`
block) currently has three children in a row: the Discard (✕) button, a
centered title/elapsed-time div, then the Finish (✓) button:

```jsx
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Discard')} onClick={...}><Icon name="xmark" /></button>
      <div style={{ textAlign: 'center' }}>...</div>
      <button className="iconbtn" style={{ color: 'var(--acc)' }} aria-label={t('Finish')} onClick={finishWorkout}><Icon name="check" /></button>
    </div>
```

Insert a new button between the centered div and the Finish button:

```jsx
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Discard')} onClick={...}><Icon name="xmark" /></button>
      <div style={{ textAlign: 'center' }}>...</div>
      <button
        className="iconbtn"
        aria-label={A.pausedAt ? t('Resume') : t('Pause')}
        onClick={() => (A.pausedAt ? resumeWorkout() : pauseWorkout())}
      >
        <Icon name={A.pausedAt ? 'play' : 'pause'} />
      </button>
      <button className="iconbtn" style={{ color: 'var(--acc)' }} aria-label={t('Finish')} onClick={finishWorkout}><Icon name="check" /></button>
    </div>
```

(The centered div's own contents and the Discard/Finish buttons' existing
`onClick` handlers are untouched — only the new pause/resume button is
added, right before Finish.) Import `pauseWorkout, resumeWorkout` from
`../sheets.jsx` in `Workout.jsx`'s existing sheets import line.

- [ ] **Step 3: Reflect pause state on TabBar and Home**

In `TabBar.jsx`, the active-session button currently reads:

```jsx
<button className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
  <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
  <span>{S.active ? t('Resume') : t('Start')}</span>
</button>
```

Change the label (not the click behavior — tapping it still resumes into
the workout screen either way, where the actual pause/resume control from
Step 2 lives) to a three-state label:

```jsx
<button className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
  <span className="cir"><Icon name={S.active ? (S.active.pausedAt ? 'pause' : 'play') : 'dumbbell'} /></span>
  <span>{S.active ? (S.active.pausedAt ? t('En pause') : t('Resume')) : t('Start')}</span>
</button>
```

In `Home.jsx`'s `ClassicHome` "today-row" (the block rendering `<span
className="tag resume pop">{t('Resume')}</span>` when `S.active` is set)
and in `NextSessionCard` (Task 2, the equivalent `<span className="tag
resume pop">{S.active ? t('Resume') : t('Start')}</span>`), apply the same
conditional: `S.active.pausedAt ? t('En pause') : t('Resume')`.

- [ ] **Step 4: Manual verification**

- Start a workout — button reads "Start" before, "Resume" during.
- Tap the new pause icon in the workout header — the elapsed clock freezes;
  TabBar and Home (navigate back to Home without finishing) both show "En
  pause" instead of "Resume".
- Tap resume (same icon, now showing play) — clock resumes ticking from
  where it froze, not from zero; TabBar/Home flip back to "Resume".
- Finish a workout that was paused at some point — confirm the recorded
  duration (visible in the post-workout summary / History) excludes the
  paused time (per Task 6 Step 6).
- Discard a paused workout — confirm no errors, no lingering interval (no
  console warnings about state updates after unmount).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Workout.jsx frontend/src/components/TabBar.jsx frontend/src/views/Home.jsx
git commit -m "feat(workout): wire pause/resume controls into the session screen, tab bar, and home"
```

---

## Task 8: Restricted simplified mode in the workout screen

**Files:**
- Modify: `frontend/src/views/Workout.jsx`

**Interfaces:**
- Consumes: `S.simpleMode` (existing store field, already used in
  `Home.jsx` and `sheets.jsx`).
- Produces: none.

- [ ] **Step 1: Hide the volume total from the workout header in simple mode**

In `Workout.jsx`'s active-session header sub-line (currently:
`<Elapsed start={A.start} .../> · {t('{0} sets', done + '/' + total)}{volume > 0 ? ' · ' + fmtNum(...) + ... : ''}`),
wrap the volume segment:

```jsx
<div className="sub">
  <Elapsed start={A.start} pausedAt={A.pausedAt} pausedMs={A.pausedMs} /> · {t('{0} sets', done + '/' + total)}
  {!S.simpleMode && volume > 0 ? ' · ' + fmtNum(Math.round(volume)) + ' ' + S.unit : ''}
</div>
```

- [ ] **Step 2: Default the swap scope silently to "once" in simple mode**

In `SwapPicker`'s `pick` function (`sheets.jsx`, from Task 5), read
`S.simpleMode` and skip the dialog:

```js
  const pick = newEx => {
    if (!routineId || S().simpleMode) { close(); onSwap(newEx); return }
    close()
    ui().openSheet(closeScope => (
      <SwapScopeDialog newEx={newEx} current={current} routineId={routineId} onSwap={onSwap} close={closeScope} />
    ), { kind: 'center' })
  }
```

(`S()` is the module-level store-state getter already defined at the top of
`sheets.jsx` — no new import needed.)

- [ ] **Step 3: Manual verification**

- Beginner mode ON: start a workout, confirm the header shows only elapsed
  time + sets done (no volume figure); swap an exercise, confirm no scope
  dialog appears (always session-only).
- Beginner mode OFF: confirm both are back — volume shown, scope dialog
  appears on swap when inside a routine-backed session.
- Confirm no other screen's behavior changed (Plan, Library, Stats,
  Nutrition untouched by `S.simpleMode`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Workout.jsx frontend/src/sheets.jsx
git commit -m "feat(workout): restrict simplified mode's effect to the workout screen"
```

---

## Task 9: Similar-exercise shortcuts in the exercise detail sheet

**Files:**
- Modify: `frontend/src/sheets.jsx`

**Interfaces:**
- Consumes: `allExercises`, `EXDB` (already imported in `sheets.jsx`).
- Produces: none (leaf UI addition inside `ExerciseDetail`).

- [ ] **Step 1: Compute the similar-exercises list in `ExerciseDetail`**

In `ExerciseDetail` (`frontend/src/sheets.jsx`), after the existing
`const muscles = ex.exercise_muscles || {}` line, add:

```js
  const similar = allExercises(st)
    .filter(e => e.id !== ex.id)
    .map(e => ({ ...e, score: (e.bp && e.bp === ex.bp ? 10 : 0) + (e.eq && e.eq === ex.eq ? 5 : 0) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
```

(Same scoring rule as `SwapPicker`, per spec §6 — deliberately duplicated
rather than shared, since `SwapPicker` is keyed by exercise *id* and this is
keyed by an already-resolved exercise *object*; extracting a shared helper
would need a signature change to `SwapPicker` too, which is out of scope
here.)

- [ ] **Step 2: Render the row**

Add this block right after the `{Object.keys(muscles).length > 0 && (
<button ... View in 3D ...)}` block (still before the `{instructions.length
> 0 && ...}` block):

```jsx
    {similar.length > 0 && (
      <div style={{ marginTop: 14 }}>
        <h4 className="sec" style={{ marginBottom: 8 }}>{t('Exercices similaires')}</h4>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {similar.map(e => (
            <div
              key={e.id}
              className="tap"
              style={{ flexShrink: 0, width: 60, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => exerciseDetailSheet(e)}
            >
              <Thumb ex={e} />
              <div className="small capitalize" style={{ fontSize: 11, lineHeight: 1.25, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.n}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
```

`Thumb` (`components/Media.jsx`) renders at a fixed `50×50px` via its
`.thumb` CSS class (no `style`/`className` override prop exists on it, and
none is needed) — the wrapping `div` above is `60px` wide purely to give
the name label a little breathing room either side of that fixed thumb; no
change to `Media.jsx` is needed for this task.

- [ ] **Step 3: Manual verification**

- Open an exercise with common body part/equipment (e.g. a barbell chest
  press) — confirm up to 6 similar exercises appear as a horizontal
  scrollable row, tapping one navigates the sheet to that exercise's own
  detail (title, muscles, instructions all update).
- Open an exercise with a rare body part/equipment combo (e.g. a custom
  exercise with no matches) — confirm the row is simply absent, no empty
  heading.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/sheets.jsx
git commit -m "feat(exercise-detail): add similar-exercise shortcuts row"
```

---

## Task 10: 3D view fixes — sticky header, bottom padding, load more

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/views/AnatomyView.jsx`

**Interfaces:** none — fully self-contained view/style fixes.

- [ ] **Step 1: Make the exercise-panel header sticky**

In `frontend/src/index.css`, update `.anatomy-panel-hdr` (currently
`display:flex;align-items:center;justify-content:space-between;margin-bottom:4px`):

```css
.anatomy-panel-hdr{
  display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;
  position:sticky;top:0;z-index:1;
  background:var(--surface);padding:2px 0 6px;margin-top:-2px;
}
```

(`background:var(--surface)` matches `.anatomy-panel`'s own background so
list rows don't show through while scrolled underneath; the small negative
margin/padding keeps the sticky bar's hit area flush with the panel's own
`14px 16px` padding instead of leaving a visible gap.)

- [ ] **Step 2: Fix bottom padding so the tab bar doesn't cover the last row**

In `frontend/src/index.css`, update the mobile `.anatomy-panel` rule
(the one inside the base, non-media-query block — leave the `@media
(min-width:1000px)` variant at the bottom of the file untouched, since
desktop has no fixed bottom tab bar overlapping this panel):

```css
.anatomy-panel{
  flex:0 0 auto;max-height:45vh;overflow-y:auto;
  background:var(--surface);border-top:var(--hair) solid var(--sep-op);
  border-radius:var(--r-xl) var(--r-xl) 0 0;
  padding:14px 16px calc(128px + var(--sab));
  box-shadow:0 -12px 30px -14px rgba(0,0,0,.4);
}
```

(Only the bottom padding value changes, from `calc(16px + var(--sab))` to
`calc(128px + var(--sab))`, matching `#app`'s own reserved space for the
fixed tab bar.)

- [ ] **Step 3: Replace the hard 30-item cap with paginated "Charger plus"**

In `frontend/src/views/AnatomyView.jsx`:

Add a `shown` state, reset whenever the selection changes:

```js
  const [shown, setShown] = useState(30)
```

In `handleMuscleClick`, every branch that calls `setSelected(...)` with a
non-null value should also reset `setShown(30)`. Update the callback:

```jsx
  const handleMuscleClick = useCallback((muscleKey, mesh) => {
    const inExercise = effectiveHeatmap && (effectiveHeatmap[muscleKey] ?? 0) > 0
    if (effectiveHeatmap && !inExercise) {
      confirmSheet({
        title: t('Leave this exercise?'),
        message: t('This muscle isn’t part of the exercise shown. Selecting it switches to free 3D exploration.'),
        confirmText: t('View this muscle'),
        cancelText: t('Cancel'),
        onConfirm: () => {
          setHeatmapDismissed(true)
          setShown(30)
          setSelected({ muscleKey, mesh })
        },
      })
      return
    }
    setSelected(prev => {
      if (prev?.muscleKey === muscleKey) return null
      setShown(30)
      return { muscleKey, mesh }
    })
  }, [effectiveHeatmap])
```

Update the panel's list rendering (replace the fixed `list.slice(0, 30)` and
the "Showing top X of Y" text):

```jsx
          <div className="small muted" style={{ marginBottom: 10 }}>
            {list.length > shown
              ? t('Showing top {0} of {1} exercises', shown, list.length)
              : t('{0} exercises target this muscle', list.length)}
          </div>
          <div className="list">
            {list.slice(0, shown).map(ex => (
              <div key={ex.id} className="item" onClick={() => exerciseDetailSheet(ex)}>
                <div className="grow">
                  <div className="tt capitalize">{ex.n}</div>
                  <div className="ss">{ex.exercise_muscles[selected.muscleKey]}%</div>
                </div>
                <Icon name="chevronRight" className="chev" />
              </div>
            ))}
            {list.length === 0 && <div className="empty">{t('No exercises found for this muscle.')}</div>}
          </div>
          {list.length > shown && (
            <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 30)}>{t('Show more')}</Button></>
          )}
```

`Button` needs importing in `AnatomyView.jsx` — add
`import { Button } from '../components/ui.jsx'` to its imports.

- [ ] **Step 4: Manual verification**

- Open the 3D view, tap a high-count muscle (e.g. deltoïde antérieur, ~309
  exercises per the original bug report) — confirm the header ("Deltoïde
  antérieur" + close button) stays pinned at the top of the panel while the
  list scrolls underneath it, confirm "Show more" appends 30 more each tap
  and the "Showing top N of 309" text updates to match, confirm the very
  last exercise row (once fully loaded) is fully tappable above the tab
  bar, not clipped.
- Tap a low-count muscle (≤30 exercises) — confirm no "Show more" button
  appears and the copy reads "{N} exercises target this muscle" (no "top of"
  framing).
- Deselect and pick a different muscle — confirm `shown` resets to 30
  (doesn't carry over the previous muscle's expanded count).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/views/AnatomyView.jsx
git commit -m "fix(anatomy): sticky exercise-list header, tab-bar-safe padding, paginated list"
```

---

## Task 11: Read-only programme week browser

**Files:**
- Modify: `frontend/src/sheets.jsx`
- Modify: `frontend/src/components/ProgrammeCard.jsx`

**Interfaces:**
- Consumes: `sessionStates(prog, weekNum)`, `isWeekComplete` (already
  imported in `sheets.jsx`); routine lookup/label pattern already used in
  `ProgrammeEditor` (`routines.find(r => r.id === s.routineId)`).
- Produces: `programmeWeeksSheet(prog)` exported from `sheets.jsx`.

- [ ] **Step 1: Add the week browser sheet**

Add to `frontend/src/sheets.jsx`, near `ProgrammeEditor`:

```jsx
function ProgrammeWeeks({ prog, close }) {
  const st = useStore(s => s.S)
  const [week, setWeek] = useState(prog.currentWeek)
  const states = sessionStates(prog, week)
  const badge = { done: { icon: 'check', color: 'var(--green)' }, next: { icon: 'play', color: 'var(--acc)' }, upcoming: { icon: 'clock', color: 'var(--label-4)' } }
  return <>
    <h3>{prog.name}</h3>
    <div className="row between" style={{ margin: '10px 0 14px' }}>
      <button className="iconbtn" disabled={week <= 1} onClick={() => setWeek(w => Math.max(1, w - 1))} aria-label={t('Previous week')}>
        <Icon name="chevronLeft" />
      </button>
      <div className="small" style={{ fontWeight: 600 }}>{t('Semaine {0}/{1}', week, prog.totalWeeks)}</div>
      <button className="iconbtn" disabled={week >= prog.totalWeeks} onClick={() => setWeek(w => Math.min(prog.totalWeeks, w + 1))} aria-label={t('Next week')}>
        <Icon name="chevronRight" />
      </button>
    </div>
    <div className="list">
      {prog.routineIds.map((routineId, i) => {
        const routine = st.routines.find(r => r.id === routineId)
        const state = states[i]
        const b = badge[state]
        return (
          <div key={i} className="item" style={{ opacity: state === 'upcoming' ? 0.6 : 1 }}>
            <span className="lrow-i" style={{ background: b.color }}><Icon name={b.icon} /></span>
            <div className="grow">
              <div className="tt">{routine ? routine.name : t('Séance')}</div>
              <div className="ss">{state === 'done' ? t('Terminée') : state === 'next' ? t('Prochaine') : t('À venir')}</div>
            </div>
          </div>
        )
      })}
    </div>
    <div style={{ height: 10 }} />
    <Button onClick={close}>{t('Close')}</Button>
  </>
}
export const programmeWeeksSheet = prog => ui().openSheet(close => <ProgrammeWeeks prog={prog} close={close} />)
```

This is intentionally read-only: no row has a click handler, matching the
spec's requirement that only the actual "next" session stays launchable
(via the existing Task 2 card / TabBar, not from this browser).

- [ ] **Step 2: Add an entry point on `ProgrammeCard`**

`ProgrammeCard`'s whole tile currently opens `programmeEditSheet` on click.
Add a small secondary affordance rather than replacing that tap target —
in `frontend/src/components/ProgrammeCard.jsx`, add a button next to the
existing delete button (top-right), and import
`programmeWeeksSheet` alongside the existing `programmeEditSheet` import:

```jsx
import { programmeEditSheet, programmeWeeksSheet, deleteProgramme } from '../sheets.jsx'
```

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

(Positioned at `right: 46` so it sits left of the existing delete button at
`right: 5`, both 36px wide with a small gap — avoids overlapping the
existing delete target.)

- [ ] **Step 3: Manual verification**

- Tap the new calendar icon on a programme card — confirm it opens the week
  browser instead of the edit sheet (which still opens from tapping the
  rest of the card).
- Navigate to a future week — confirm every session shows "À venir" and
  nothing is clickable.
- Navigate to the current week — confirm the right session(s) show
  "Terminée"/"Prochaine" matching what `ProgrammeEditor`'s own session list
  would imply for the same programme.
- Navigate to a past, fully-done week — confirm every session shows
  "Terminée".
- Confirm the Previous/Next buttons disable at week 1 and at `totalWeeks`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/sheets.jsx frontend/src/components/ProgrammeCard.jsx
git commit -m "feat(programme): add read-only week-by-week session browser"
```

---

## Final check (after all 11 tasks)

- [ ] Run the full test suite once more from `frontend/`: `npm run test` —
  confirm every existing test still passes alongside the new
  `programme.test.js` and the added `history.test.js` cases.
- [ ] Run `npm run build` from `frontend/` — confirm the production build
  still succeeds (no stray unused-import or syntax errors across the 8
  touched files).
- [ ] `npm run dev` once more, walk each of the 8 numbered spec sections
  end-to-end in the running app.
