# Visual Redesign Phase 2 — Accueil (Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `frontend/src/views/Home.jsx` (both `ProgrammeHome` and `ClassicHome`) to match the `01-Accueil.html` mockup's information hierarchy — mini-stat row, single "Prochaine séance" hero, a collapsible week browser, a "Progression récente" card, a wrapped nutrition section — while preserving every existing interaction (confirm-before-start, pause/resume, the swipeable multi-week checklist, ad-hoc sessions, quick-log sheets, the tutorial overlay) with zero behavior change.

**Architecture:** Two small pure helpers land in `lib/history.js` (a weight-trend calculator extracted from `ClassicHome`'s existing inline logic, and a per-day volume array for the new "Progression récente" card). Everything else is JSX restructuring inside `Home.jsx`: a local `SectionHead` presentational helper, a mini-stat row, a restyled hero, and a collapsible wrapper around the two variants' existing week views (`ProgrammeWeekCarousel` for `ProgrammeHome`, the week-schedule card for `ClassicHome`). No routing, store, or sheet logic changes.

**Tech Stack:** React 19, Zustand, Vite, Vitest (pure-logic tests only — no component-test infra in this repo).

**Spec:** `docs/superpowers/specs/2026-09-27-visual-redesign-phase2-accueil-design.md`

## Global Constraints

- All new/changed UI must work in both themes (`:root` dark default, `:root[data-theme="light"]`) and must not hardcode colors that bypass the `--acc`/`--glass-*`/`--label-*` token system introduced in Phase 1.
- No new pure-logic function is added without a Vitest test in the matching `*.test.js` file, per this repo's established convention (component behavior is verified manually in the browser, pure logic is unit-tested).
- Every `data-tuto="home-*"` attribute that exists today must keep pointing at an element that stays mounted (not conditionally unmounted) after this plan, so `HOME_STEPS` (`frontend/src/lib/tutorials.js`) keeps working — verified manually per task, not by a new test (no component-test infra).
- No fabricated data: if the mockup shows a value this app doesn't track (e.g., per-routine estimated duration), that visual element is dropped, never hardcoded or invented.
- French UI strings go through `t(...)`, matching every existing string in this file.
- Reuse existing sheets/handlers verbatim (`bwSheet`, `confirmStartSheet`, `startFlowForProgramme`, `startFlow`, `resumeWorkout`, `addAdHocSessionSheet`, `workoutDetailSheet`) — this plan changes presentation, not the state machine.

## Review Focus

- **Tutorial overlay after the week view becomes collapsible (ClassicHome).** `TutorialOverlay` (`frontend/src/components/TutorialOverlay.jsx:35`) resolves steps with `document.querySelector(selector)` and returns `null` if nothing matches — a step whose target got conditionally unmounted silently breaks, it doesn't gracefully skip. Task 9 must keep `data-tuto="home-week"` and `data-tuto="home-today"` on elements that stay mounted whether the week view is collapsed or expanded.
- **`lastBW(S)` returning `null` in the new `ProgrammeHome` weight mini-stat.** `ProgrammeHome` has never rendered a weight/trend card before — unlike `ClassicHome`, which already guards `bw`-derived values throughout. Task 3's mini-stat card and Task 2's `bwTrend` helper must both handle zero and one bodyweight entries without throwing (only `bwTrend`'s own test proves this; the JSX consuming it must not re-derive nulls unsafely).
- **`nextSession(prog, S.routines)` returning `null` while `prog` is still the one `activeProgramme(S)` returned.** This only happens with a misconfigured programme (empty `routineIds`), but the current code has no explicit handling for it in the carousel path either — Task 4 must render a safe fallback (no session data) rather than crash on `ns.routine.name`.
- **Volume bar heights when every day this week is 0.** `weekDayVolumes` returning `[0,0,0,0,0,0,0]` (the common case for a returning or brand-new user) must not collapse every bar to 0px height — Task 6 needs an explicit minimum visual height, matching the mockup's resting-state bars.
- **The programme-fully-complete state.** `activeProgramme(S)` returns `null` once every programme is paused/complete, which today makes `ProgrammeHome` render its hero region as nothing at all (`prog ? <ProgrammeWeekCarousel .../> : null`, `frontend/src/views/Home.jsx:428`). Task 4 replaces that blank gap with an explicit empty/complete state per the spec, instead of carrying the silent blank forward.

---

## Task 1: `weekDayVolumes` — per-day trained volume for the current week

**Files:**
- Modify: `frontend/src/lib/history.js`
- Test: `frontend/src/lib/history.test.js`

**Interfaces:**
- Consumes: `workoutVolume(w)` (already exported, `frontend/src/lib/history.js:231`), `isoOf` (imported from `./format.js`, already available in this file)
- Produces: `weekDayVolumes(S) → number[7]` — Monday-first daily trained volume for the current calendar week. `S.workouts` is `{ d: 'YYYY-MM-DD', entries: [...] }[]`. Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

```js
// frontend/src/lib/history.test.js — add to the existing describe blocks
describe('weekDayVolumes', () => {
  it('buckets each workout into its weekday slot, Monday-first', () => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const isoAt = offset => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + offset)
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }
    const mkWorkout = (d, w, r) => ({ d, entries: [{ sets: [{ done: true, w, r }] }] })
    const S = {
      workouts: [
        mkWorkout(isoAt(0), 100, 5),   // Monday: 500
        mkWorkout(isoAt(0), 20, 5),    // Monday, second workout same day: +100 = 600
        mkWorkout(isoAt(3), 50, 10),   // Thursday: 500
      ],
    }
    const result = weekDayVolumes(S)
    expect(result).toHaveLength(7)
    expect(result[0]).toBe(600)
    expect(result[3]).toBe(500)
    expect(result[1]).toBe(0)
  })

  it('returns all zeros when there are no workouts this week', () => {
    expect(weekDayVolumes({ workouts: [] })).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('ignores workouts from other weeks', () => {
    const S = { workouts: [{ d: '2020-01-01', entries: [{ sets: [{ done: true, w: 100, r: 10 }] }] }] }
    expect(weekDayVolumes(S)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- history.test.js -t weekDayVolumes`
Expected: FAIL with `weekDayVolumes is not a function` (or `ReferenceError`/import error).

- [ ] **Step 3: Write minimal implementation**

```js
// frontend/src/lib/history.js — add after workoutVolume (around line 235)

// Per-day trained volume for the current week (Monday-first). Both the
// weekly total and the daily bars on Home's "Progression récente" card are
// derived from this one array so they can never drift apart.
export function weekDayVolumes(S) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    return S.workouts
      .filter(w => w.d === iso)
      .reduce((sum, w) => sum + workoutVolume(w), 0)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- history.test.js -t weekDayVolumes`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/history.js frontend/src/lib/history.test.js
git commit -m "$(cat <<'EOF'
feat: add weekDayVolumes helper for Home's progression card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `bwTrend` — extract the weight-trend calculation, share it with ProgrammeHome

**Files:**
- Modify: `frontend/src/lib/history.js`
- Modify: `frontend/src/views/Home.jsx:492-497` (ClassicHome's inline calc → call the new helper)
- Test: `frontend/src/lib/history.test.js`

**Interfaces:**
- Consumes: `lastBW(S)` (already exported, `frontend/src/lib/history.js:246`)
- Produces: `bwTrend(S) → { bw, prevBW, delta, trendDir, totalDelta, firstBW }` where `trendDir` is `null | 'stable' | 'up' | 'down'`. Consumed by Task 3 (`ProgrammeHome`'s new weight mini-stat) and by `ClassicHome`'s existing weight card (this task only swaps its data source, no visual change).

- [ ] **Step 1: Write the failing test**

```js
// frontend/src/lib/history.test.js
describe('bwTrend', () => {
  it('returns all nulls with no entries', () => {
    expect(bwTrend({ bodyweight: [] })).toEqual({
      bw: null, prevBW: null, delta: null, trendDir: null, totalDelta: null, firstBW: null,
    })
  })

  it('has no trend with a single entry', () => {
    const S = { bodyweight: [{ d: '2026-09-01', w: 80 }] }
    const r = bwTrend(S)
    expect(r.bw.w).toBe(80)
    expect(r.delta).toBeNull()
    expect(r.trendDir).toBeNull()
  })

  it('classifies a small change as stable (under 0.3)', () => {
    const S = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-02', w: 80.2 }] }
    expect(bwTrend(S).trendDir).toBe('stable')
  })

  it('classifies a gain as up and a loss as down', () => {
    const up = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-02', w: 81 }] }
    const down = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-02', w: 79 }] }
    expect(bwTrend(up).trendDir).toBe('up')
    expect(bwTrend(down).trendDir).toBe('down')
  })

  it('computes totalDelta from the very first entry, rounded to 1 decimal', () => {
    const S = { bodyweight: [{ d: '2026-09-01', w: 80 }, { d: '2026-09-10', w: 78.55 }] }
    expect(bwTrend(S).totalDelta).toBe(-1.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- history.test.js -t bwTrend`
Expected: FAIL with `bwTrend is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
// frontend/src/lib/history.js — add after lastBW (around line 246)

// Weight-trend snapshot shared by Home's weight mini-stat (both variants)
// and the full body-weight card — one calculation, not duplicated per screen.
export function bwTrend(S) {
  const bw = lastBW(S)
  if (!bw) return { bw: null, prevBW: null, delta: null, trendDir: null, totalDelta: null, firstBW: null }
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = prevBW ? bw.w - prevBW.w : null
  const firstBW = S.bodyweight.length > 1 ? S.bodyweight[0] : null
  const totalDelta = firstBW ? Math.round((bw.w - firstBW.w) * 10) / 10 : null
  const trendDir = delta === null ? null : Math.abs(delta) < 0.3 ? 'stable' : delta > 0 ? 'up' : 'down'
  return { bw, prevBW, delta, trendDir, totalDelta, firstBW }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- history.test.js -t bwTrend`
Expected: PASS (5/5)

- [ ] **Step 5: Swap ClassicHome's inline calc for the helper**

```jsx
// frontend/src/views/Home.jsx — replace lines 492-497
  const { bw, delta, trendDir, totalDelta, firstBW } = bwTrend(S)
```

Add `bwTrend` to the `lib/history.js` import list at the top of the file (`frontend/src/views/Home.jsx:5`):

```jsx
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, bwTrend, weekDayVolumes, setsDoneActive } from '../lib/history.js'
```

(`weekDayVolumes` is pulled in now too, ready for Task 6.)

- [ ] **Step 6: Run the full test suite and manually confirm ClassicHome's weight card is pixel-identical**

Run: `npm --prefix frontend test`
Expected: PASS, no regressions
Manual: open `/home` with no active programme, a body-weight history of 2+ entries — the weight card (trend arrow, delta, total-delta line) must render exactly as before.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/history.js frontend/src/lib/history.test.js frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
refactor: extract bwTrend helper, share it between ClassicHome and ProgrammeHome

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `SectionHead` helper + mini-stat row for ProgrammeHome

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `bwTrend(S)` (Task 2), `sessionStates(prog, weekNum)` (already exported, `frontend/src/lib/programme.js:6`), `bwSheet` (already imported), `bwDeltaColor` (already imported from `../sheets.jsx`)
- Produces: `SectionHead({ title, action, onAction })` — a small presentational component reused by Tasks 4, 6, 7 for every mockup-style section header ("Prochaine séance / Voir les semaines", "Progression récente / Détails", "Nutrition / Ajouter").

- [ ] **Step 1: Add the `SectionHead` component**

Insert above `ProgrammeWeekCarousel` (before line 244 in the current file):

```jsx
// ── Mockup-style section header: title + a small right-aligned action ──
function SectionHead({ title, action, onAction }) {
  return (
    <div className="row between" style={{ marginBottom: 2 }}>
      <h3 className="font-display" style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '.002em' }}>{title}</h3>
      {action && (
        <button className="iconbtn" style={{ width: 'auto', height: 'auto', padding: 0, fontSize: 11, fontWeight: 600, color: 'var(--acc)' }} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the mini-stat row to `ProgrammeHome`**

Replace the `"My programmes"` block's position is untouched in this step (moves in Task 7) — insert the mini-stat row right after the `<div className="hdr" ...>` block closes (after line 410, before the "My programmes" block at line 412):

```jsx
      {(() => {
        const prog = activeProgramme(S)
        const wk = prog ? sessionStates(prog, prog.currentWeek) : []
        const doneThisWeek = wk.filter(s => s === 'done').length
        const totalThisWeek = wk.length
        const pct = totalThisWeek ? Math.round((doneThisWeek / totalThisWeek) * 100) : 0
        const { bw, trendDir, delta } = bwTrend(S)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="card" style={{ padding: '12px 13px', marginBottom: 0 }}>
              <div className="small" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Cette semaine')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
                <span className="font-display" style={{ fontSize: 25, fontWeight: 700 }}>{doneThisWeek}</span>
                {totalThisWeek > 0 && <span style={{ fontSize: 13, color: 'var(--label-3)', fontWeight: 600 }}>/ {totalThisWeek}</span>}
              </div>
              <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, marginTop: 9, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: 'var(--acc)' }} />
              </div>
            </div>
            <div className="card tap" style={{ padding: '12px 13px', marginBottom: 0 }} onClick={() => bwSheet()}>
              <div className="small" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Poids')}</div>
              {bw ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                    <span className="font-display" style={{ fontSize: 25, fontWeight: 700 }}>{fmtNum(bw.w)}</span>
                    <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 600 }}>{S.unit}</span>
                    {trendDir && trendDir !== 'stable' && (
                      <Icon name={trendDir === 'up' ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 11, marginLeft: 2, color: bwDeltaColor(delta, bw.w) }} />
                    )}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
                </>
              ) : (
                <>
                  <div className="font-display" style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{t('Aucune pesée')}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
                </>
              )}
            </div>
          </div>
        )
      })()}

```

- [ ] **Step 3: Manual verification**

Run: `npm --prefix frontend run build` (catches JSX/syntax errors — no component-test infra for a visual check)
Expected: build succeeds
Manual (dev server, `/home`, with an active programme):
- With 0 body-weight entries: "Poids" card shows "Aucune pesée" / "Enregistrer", no crash.
- With 2+ entries: shows the last weight, unit, and an up/down arrow colored per `bwDeltaColor` when the trend isn't stable.
- Tapping the "Poids" card opens the existing body-weight sheet (`bwSheet()`).
- "Cette semaine" shows `X/N` matching the active programme's current-week `sessionStates`.
- Both themes look correct (`data-theme="light"` toggle in Settings, or via `javascript_tool` setting `document.documentElement.dataset.theme`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
feat(design): add SectionHead helper and Accueil mini-stat row (ProgrammeHome)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Restyle the "Prochaine séance" hero card (ProgrammeHome)

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `nextSession(prog, S.routines)` (already exported, `frontend/src/lib/programme.js:66`), `activeProgramme(S)` (already imported), `S.active` (store shape, already used elsewhere in this file), `confirmStartSheet`, `startFlowForProgramme`, `resumeWorkout` (import needed — see below), `isCardioSport` (already imported)
- Produces: replaces the bare `{(() => { const prog = activeProgramme(S); return prog ? <ProgrammeWeekCarousel S={S} prog={prog} /> : null })()}` line (`frontend/src/views/Home.jsx:428`) with a `SectionHead` + hero card. `ProgrammeWeekCarousel` itself is not called from here anymore — Task 5 relocates it behind the toggle.

`resumeWorkout` is exported from `../sheets.jsx` and already imported in `TabBar.jsx` (`frontend/src/components/TabBar.jsx:6`) but not yet in `Home.jsx` — add it to this file's sheets import.

- [ ] **Step 1: Add `resumeWorkout` to the sheets import**

```jsx
// frontend/src/views/Home.jsx:8 — add resumeWorkout
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, cardioLogSheet, workoutDetailSheet, measurementsSheet, startFlowForProgramme, confirmStartSheet, addAdHocSessionSheet, resumeWorkout } from '../sheets.jsx'
```

- [ ] **Step 2: Replace the carousel line with the hero section**

Replace `frontend/src/views/Home.jsx:428` (the single carousel-or-null line) with:

```jsx
      {(() => {
        const prog = activeProgramme(S)
        if (!prog) return null
        const ns = nextSession(prog, S.routines)
        const activeRoute = S.active && isCardioSport(S.active.sport) ? '/cardio' : '/workout'
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <SectionHead title={t('Prochaine séance')} action={weekBrowserOpen ? t('Masquer') : t('Voir les semaines')} onAction={() => setWeekBrowserOpen(o => !o)} />
            {S.active ? (
              <div className="card" style={{
                border: '1.5px solid color-mix(in srgb,var(--orange) 32%,transparent)',
                background: 'linear-gradient(165deg,color-mix(in srgb,var(--orange) 7%,var(--glass-fill)),var(--glass-fill))',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', color: 'var(--orange)', textTransform: 'uppercase' }}>
                  {S.active.pausedAt ? t('En pause') : t('Séance en cours')}
                </div>
                <div className="font-display" style={{ fontWeight: 700, fontSize: 19 }}>{S.active.name}</div>
                <button className="btn cta" onClick={() => { if (S.active.pausedAt) { resumeWorkout(); nav(activeRoute) } else nav(activeRoute) }}>
                  <Icon name={S.active.pausedAt ? 'play' : 'timer'} />
                  <span>{S.active.pausedAt ? t('Reprendre') : t('Continuer')}</span>
                </button>
              </div>
            ) : ns && ns.routine ? (
              <div style={{
                position: 'relative', border: '1px solid color-mix(in srgb,var(--acc) 32%,transparent)', borderRadius: 18,
                background: 'linear-gradient(165deg,color-mix(in srgb,var(--acc) 7%,var(--glass-fill)),var(--glass-fill))',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: 'inset 0 1px 0 var(--glass-highlight)',
              }}>
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc)', display: 'inline-block' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', color: 'var(--acc)', textTransform: 'uppercase' }}>
                      {t('Prochaine')} · {ns.routine.name}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 19 }}>{ns.routine.name}</div>
                  {ns.routine.ex?.length > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--label-2)', marginTop: 2 }}>{t('{0} exercises', ns.routine.ex.length)}</div>
                  )}
                </div>
                <button className="btn cta" onClick={() => confirmStartSheet(ns.routine, () => startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx))}>
                  <Icon name="play" />
                  <span>{t('Démarrer la séance')}</span>
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div className="font-display" style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t('Programme terminé')}</div>
                <div className="muted small">{t('Toutes les séances de ce programme ont été complétées.')}</div>
              </div>
            )}
            {weekBrowserOpen && <ProgrammeWeekCarousel S={S} prog={prog} />}
          </div>
        )
      })()}
```

- [ ] **Step 3: Add the `weekBrowserOpen` state to `ProgrammeHome`**

```jsx
// frontend/src/views/Home.jsx — inside function ProgrammeHome({ S, user, nav }) {, near the top
  const [weekBrowserOpen, setWeekBrowserOpen] = useState(false)
```

(`useState` is already imported at the top of the file.)

- [ ] **Step 4: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual:
- Active programme, no session in progress → hero shows "Prochaine · {routine}" + `.btn.cta` "Démarrer la séance"; tapping it opens the existing confirm sheet and starts the flow exactly as before.
- Start a workout, return to `/home` → hero switches to the orange "in progress"/"paused" state with a working Reprendre/Continuer button (verify pause and resume both work, matching `TabBar.jsx`'s existing `startWorkout()` behavior).
- Programme with every session done (or a paused/complete programme as the only one, so `activeProgramme(S)` is `null`) → previously blank gap, now either nothing (if genuinely no programme) or the "Programme terminé" card (only reachable if `activeProgramme` momentarily returns a complete-but-not-yet-filtered prog — verify by checking this state is actually reachable; if `activeProgramme`'s filter makes it unreachable in practice, note that in the ledger as a ruling and leave the fallback in as defensive UI, not dead code needing removal).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
feat(design): restyle Accueil hero card to the mockup's single-card layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Restyle `ProgrammeWeekCarousel`'s outer card to the glass tokens

**Files:**
- Modify: `frontend/src/views/Home.jsx:307-390` (`ProgrammeWeekCarousel`'s return block)

**Interfaces:**
- Consumes: nothing new — internal restyle only, all props/behavior unchanged
- Produces: nothing new — consumed already by Task 4's `weekBrowserOpen` conditional

- [ ] **Step 1: Update the outer card's inline styles**

Replace `frontend/src/views/Home.jsx:308-312`:

```jsx
    <div className="card" style={{
      border: '1.5px solid color-mix(in srgb,var(--acc) 22%,transparent)',
      background: 'color-mix(in srgb,var(--acc) 6%,var(--surface))',
      padding: '14px 0 14px 14px',
    }}>
```

with:

```jsx
    <div className="card" style={{
      border: '1.5px solid color-mix(in srgb,var(--acc) 22%,transparent)',
      background: 'linear-gradient(165deg,color-mix(in srgb,var(--acc) 6%,var(--glass-fill)),var(--glass-fill))',
      padding: '14px 0 14px 14px',
    }}>
```

(The tile colors, scroll logic, dot indicators, and click handlers below this line are untouched — this step only swaps the flat `var(--surface)` background for the Phase 1 glass gradient so it visually matches the hero card above it.)

- [ ] **Step 2: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual: expand "Voir les semaines" on `/home`, confirm the carousel's card background now uses the glass gradient in both themes, and that scrolling between weeks, tapping tiles (done/next/upcoming), and "+ Ajouter une séance" all still work exactly as before (this is Phase B functionality — zero logic touched).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
style: apply glass gradient to the week carousel's outer card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: "Progression récente" card (ProgrammeHome)

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `weekDayVolumes(S)` (Task 1), `fmtNum` (already imported)
- Produces: a new section inserted after the hero/carousel block, before `SmartNudge`/`LastWorkoutCard`

- [ ] **Step 1: Insert the card**

In `ProgrammeHome`'s return, right after the `{(() => { ... hero ... })()}` block from Task 4 and before `<SmartNudge S={S} />` (currently line 430):

```jsx
      {(() => {
        const volumes = weekDayVolumes(S)
        const total = volumes.reduce((a, b) => a + b, 0)
        const max = Math.max(...volumes, 1)
        const isFirstEver = S.workouts.length === 0
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <SectionHead title={t('Progression récente')} action={t('Détails')} onAction={() => nav('/stats')} />
            <div className="card" style={{ padding: 14 }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Volume cette semaine')}</div>
                  <div className="font-display" style={{ fontSize: 20, marginTop: 5 }}>
                    {total > 0 ? fmtNum(total) : '—'} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-3)' }}>{S.unit === 'lb' ? 'lb' : 'kg'}</span>
                  </div>
                </div>
                {isFirstEver && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--acc)', background: 'color-mix(in srgb,var(--acc) 12%,transparent)', borderRadius: 999, padding: '4px 9px' }}>{t('1re séance')}</span>}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 12, alignItems: 'flex-end', height: 36 }}>
                {volumes.map((v, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: Math.max(4, Math.round((v / max) * 36)),
                    borderRadius: 5,
                    background: v > 0 ? 'color-mix(in srgb,var(--acc) 55%,transparent)' : 'var(--surface-3)',
                  }} />
                ))}
              </div>
            </div>
          </div>
        )
      })()}

```

- [ ] **Step 2: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual: `/home` with an active programme.
- No workouts logged this week → all 7 bars render at the 4px minimum height, total shows `—`.
- Some workouts logged → total matches the sum, the corresponding day's bar is visibly taller, proportional to the week's max.
- `S.workouts.length === 0` (brand-new account) → "1re séance" badge shown; otherwise not.
- Tapping "Détails" navigates to `/stats`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
feat(design): add Accueil progression-récente card (ProgrammeHome)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wrap the nutrition section, reposition the programme grid (ProgrammeHome)

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `NutriWidget` (already defined in this file), the existing "My programmes" grid block (`frontend/src/views/Home.jsx:412-426`)
- Produces: final `ProgrammeHome` layout order matching the spec: header → mini-stats → "My programmes" → hero/carousel → progression → SmartNudge/LastWorkoutCard → nutrition → quick-log → activity CTA

- [ ] **Step 1: Move the "My programmes" block**

Cut the block currently at `frontend/src/views/Home.jsx:412-426` (the `<div style={{ marginBottom: 8 }}>...My programmes...</div>`) from directly after the header, and paste it directly after the mini-stat row added in Task 3 (i.e., between the mini-stat row and the hero section from Task 4). No content changes to this block — position only.

- [ ] **Step 2: Wrap `NutriWidget` with a `SectionHead`**

Replace `frontend/src/views/Home.jsx:433-434`:

```jsx
      {/* compact nutrition widget */}
      <NutriWidget S={S} nav={nav} />
```

with:

```jsx
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <SectionHead title={t('Nutrition')} action={t('Ajouter')} onAction={() => nav('/nutrition')} />
        <NutriWidget S={S} nav={nav} />
      </div>
```

`NutriWidget` returns `null` when there's no nutrition target set today (`frontend/src/views/Home.jsx:27`) — when that happens this leaves a bare `SectionHead` with nothing under it. Guard the whole block on the same condition the widget already checks internally, without duplicating its logic: change the condition inline —

```jsx
      {(S.nutrition?.targetKcal) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <SectionHead title={t('Nutrition')} action={t('Ajouter')} onAction={() => nav('/nutrition')} />
          <NutriWidget S={S} nav={nav} />
        </div>
      )}
```

(This mirrors `NutriWidget`'s own early-return condition; if a future change to that condition drifts from this one, that's a pre-existing duplication risk the plan does not need to solve — noted, not fixed, per Global Constraints' "presentation only" scope.)

- [ ] **Step 3: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual:
- With a nutrition target set: "Nutrition" section header + widget both show, "Ajouter" navigates to `/nutrition`.
- With no nutrition target set: no orphaned header, nothing renders (matches current behavior where the widget alone was silently absent).
- "My programmes" grid now appears directly below the mini-stat row, above the hero — multi-programme switching still works exactly as before.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
feat(design): finalize ProgrammeHome section order, wrap nutrition widget

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Mini-stat row + hero for `ClassicHome`

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: `bwTrend(S)` (Task 2, already imported by Task 2 Step 5), `effectiveRoutine` (already imported), `SectionHead` (Task 3)
- Produces: mini-stat row + hero placed above the (still-present, not-yet-toggled — Task 9 handles the toggle) week-schedule card

- [ ] **Step 1: Insert the mini-stat row**

Insert right after `ClassicHome`'s `<div className="hdr" ...>` block closes (after line 531, before the `S.simpleMode` block at line 534):

```jsx
    {!S.simpleMode && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card" style={{ padding: '12px 13px', marginBottom: 0 }}>
          <div className="small" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Cette semaine')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
            <span className="font-display" style={{ fontSize: 25, fontWeight: 700 }}>{wThisWeek}</span>
            {plannedPerWeek > 0 && <span style={{ fontSize: 13, color: 'var(--label-3)', fontWeight: 600 }}>/ {plannedPerWeek}</span>}
          </div>
          <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, marginTop: 9, overflow: 'hidden' }}>
            <div style={{ width: (plannedPerWeek ? Math.min(100, Math.round((wThisWeek / plannedPerWeek) * 100)) : 0) + '%', height: '100%', background: 'var(--acc)' }} />
          </div>
        </div>
        <div className="card tap" style={{ padding: '12px 13px', marginBottom: 0 }} onClick={() => bwSheet()}>
          <div className="small" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Poids')}</div>
          {bw ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                <span className="font-display" style={{ fontSize: 25, fontWeight: 700 }}>{fmtNum(bw.w)}</span>
                <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 600 }}>{S.unit}</span>
                {trendDir && trendDir !== 'stable' && (
                  <Icon name={trendDir === 'up' ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 11, marginLeft: 2, color: bwDeltaColor(delta, bw.w) }} />
                )}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
            </>
          ) : (
            <>
              <div className="font-display" style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{t('Aucune pesée')}</div>
              <div style={{ fontSize: 9.5, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
            </>
          )}
        </div>
      </div>
    )}

```

`wThisWeek` and `plannedPerWeek` are already computed further down in `ClassicHome` (`frontend/src/views/Home.jsx:513-514`, after Task 2's edits shift line numbers slightly) — move those two `const` lines up so they're defined before this new block uses them (immediately after the `bwTrend` destructure from Task 2, before this insertion point).

- [ ] **Step 2: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual: `/home` with no programmes (`S.programmes` empty) — mini-stat row shows correctly, weight card behaves identically to `ProgrammeHome`'s (same component pattern, different data). Simple mode still shows its existing large single-CTA card unaffected (mini-stat row is hidden in that mode, matching the mockup's intent of one clear next action for beginners — a deliberate choice, not an oversight).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
feat(design): add Accueil mini-stat row to ClassicHome

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Collapsible week view for `ClassicHome`, preserving tutorial targets

**Files:**
- Modify: `frontend/src/views/Home.jsx`

**Interfaces:**
- Consumes: the existing week-schedule `<div className="card" data-tuto="home-week">...</div>` block (`frontend/src/views/Home.jsx:563-584`, line numbers shift after earlier tasks — locate by the `data-tuto="home-week"` attribute)
- Produces: the week-schedule card becomes conditionally rendered under a `SectionHead` toggle, matching `ProgrammeHome`'s pattern from Task 4/5

**This is the task the Review Focus item about the tutorial overlay applies to.** `HOME_STEPS` targets `[data-tuto="home-week"]` and `[data-tuto="home-today"]` (`frontend/src/lib/tutorials.js:15,20`) — both currently live inside the card this task is about to make conditional. If the card unmounts when collapsed, those two tutorial steps break (`TutorialOverlay`'s `getRect` returns `null` for a missing element and the step has nothing to highlight).

- [ ] **Step 1: Add the toggle state and `SectionHead`**

Add near `ClassicHome`'s other `useState` calls (with `bannerOff`):

```jsx
  const [weekViewOpen, setWeekViewOpen] = useState(false)
```

Insert a `SectionHead` immediately before the existing week card:

```jsx
    <SectionHead title={t('Cette semaine')} action={weekViewOpen ? t('Masquer') : t('Voir les semaines')} onAction={() => setWeekViewOpen(o => !o)} />
```

- [ ] **Step 2: Keep the tutorial-target attributes on an always-mounted wrapper**

Wrap the existing week card in an outer `<div data-tuto="home-week">` that stays mounted, and move the card's own conditional rendering *inside* it — so `document.querySelector('[data-tuto="home-week"]')` always resolves, even while collapsed:

```jsx
    <div data-tuto="home-week">
      {weekViewOpen && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
            <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
            <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
          </div>
          <div className="week">{strip}</div>
        </div>
      )}
      <div className="card tap" data-tuto="home-today" onClick={onToday} style={S.active ? { background: 'color-mix(in srgb,var(--orange) 8%,var(--surface-2))' } : undefined}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' \xB7 ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {S.active ? <span className="tag resume pop">{S.active.pausedAt ? t('En pause') : t('Resume')}</span>
          : routine ? <span className="tag acc pop">{t('Start')}</span>
          : <Icon name="plus" className="chev" />}
      </div>
    </div>
```

(`onToday`, `routine`, `strip`, `wkLabel`, `todayOvr`, `weekOffset`/`setWeekOffset` are all pre-existing in this scope, unchanged. The "today" row — previously named `today-row` via CSS class and always visible — now sits as its own always-visible `.card` below the collapsible week-days card, instead of nested inside one shared card, so `home-today` also stays reachable regardless of `weekViewOpen`. `className="today-row"` and its CSS are dropped in favor of the standard `.card`/`.card.tap` treatment already used everywhere else in this task, consistent with the Phase 1 glass restyle — if this changes the row's visual padding/border noticeably, that's an acceptable, expected side effect of the restyle, not a regression to chase.)

- [ ] **Step 3: Manual verification — this step is the Review Focus check, do not skip it**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual, in the browser:
1. On `/home` with no programmes, `weekViewOpen` starts `false` — confirm the week-days grid is hidden, the "Today" row is visible.
2. Open Settings → replay the Home tutorial (or trigger `HOME_STEPS` via the `TutorialButton` in the header) *without* first expanding "Voir les semaines" — step targeting `home-week` must highlight the (collapsed) wrapper without erroring or highlighting nothing; step targeting `home-today` must highlight the "Today" row correctly.
3. Toggle "Voir les semaines" open, confirm week navigation (`←`/`→` week offset) still works exactly as before.
4. Tap the "Today" row with/without an active workout, with/without a routine planned — confirm all three existing behaviors (resume, start, rest-day override sheet) are unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Home.jsx
git commit -m "$(cat <<'EOF'
feat(design): make ClassicHome's week view collapsible, keep tutorial targets mounted

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Manual QA (part of the branch's final review, not a standalone task)

Before the final whole-branch review, do one full pass covering everything the per-task manual checks above didn't combine:
- Both themes × at least 2 accent colors (`data-accent`) on every new/changed card.
- `ProgrammeHome` and `ClassicHome` both reachable (toggle `S.programmes` presence, or use two test profiles) — confirm nothing from either path regressed.
- Full `HOME_STEPS` tutorial run start-to-finish on both variants.
- `npm --prefix frontend test` and `npm --prefix frontend run build` both green.
