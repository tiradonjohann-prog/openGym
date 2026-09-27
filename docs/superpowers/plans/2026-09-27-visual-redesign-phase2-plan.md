# Visual Redesign Phase 2 — Plan Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `frontend/src/views/Plan.jsx` with two prominent animated CTAs ("Créer un programme" mint, "Créer une séance" blue), restyle the classic-planning toggle, and replace the routine library's wrapping 2-column grid with a horizontally-scrollable row of illustrated tiles carrying `Consulter`/`Ajouter au programme` actions — plus the small new pure-logic piece `Ajouter au programme` needs (re-adding a routine to the active programme without reopening finished weeks) and a one-line info banner in `RoutineEdit.jsx`.

**Architecture:** One new pure function in `lib/programme.js` (tested). Everything else is JSX restructuring inside `Plan.jsx` reusing existing components (`ProgrammeCard`, the app's `.card`/`.btn.cta`/`.no-scrollbar`/`.hairline` tokens from Phase 1) plus one new local tile component. `RoutineEdit.jsx` gets a single additive banner, no other changes.

**Tech Stack:** React 19, Zustand, Vite, Vitest (pure-logic tests only).

**Spec:** `docs/superpowers/specs/2026-09-27-visual-redesign-plan-design.md` — actual path: `docs/superpowers/specs/2026-09-27-visual-redesign-phase2-plan-design.md`

## Global Constraints

- Both themes and the 8 accent colors must keep working — reuse `--acc`/`--glass-*`/`--label-*`/`--orange`/`--blue` tokens, never hardcode a color that bypasses them except inside the two new `.btn.cta` gradient variants (already added to `index.css` in a prior commit on this branch's parent).
- `addRoutineToProgramme` mutates its `prog` argument in place, matching every other function in `lib/programme.js` (`rewindProgrammeForDeletedWorkout` is the direct precedent) — callers wrap it in the store's `update(s => ...)` immer-style mutator.
- No fabricated data or invented UI — the library tile's subtitle text reuses whatever exercise-count logic `RoutineCard.jsx` already computes (`subtitle(r)`), not a new metric.
- French UI strings go through `t(...)`.
- `Consulter` and `Ajouter au programme` are plain text pills (no icon) — matches the mockup's own "+ Plan" button, which also has no icon, and avoids picking an icon that doesn't exist in `Icon.jsx` (checked: no `eye`/`bookmark`/`layers` icon exists there today).

## Review Focus

- `addRoutineToProgramme` on a `totalWeeks: 0` or malformed programme must not throw and must add the routine with zero backfill.
- Re-adding a routine already present in `routineIds` is allowed (a routine can occur twice a week) — nothing downstream should silently dedupe it.
- The `RoutineEdit` banner must stay silent for the common case: no active programme, or a routine not referenced by one.
- The new horizontal tile row with only one routine must not show a stray scrollbar or misbehave (same `.no-scrollbar` class already proven on Accueil's week carousel, different tile width here).
- `Ajouter au programme` with no active programme must not silently no-op — it's disabled with a reason, not a dead click target.

---

## Task 1: `addRoutineToProgramme` — re-add a routine without reopening finished weeks

**Files:**
- Modify: `frontend/src/lib/programme.js`
- Test: `frontend/src/lib/programme.test.js`

**Interfaces:**
- Consumes: `isWeekComplete(prog, weekNum)` (already exported, `frontend/src/lib/programme.js:18`)
- Produces: `addRoutineToProgramme(prog, routineId)` — mutates `prog.routineIds` (appends) and `prog.weekProgress` (backfills completed weeks). No return value (matches `rewindProgrammeForDeletedWorkout`'s void-mutate style). Consumed by Task 4's "Ajouter au programme" button.

- [ ] **Step 1: Write the failing tests**

```js
// frontend/src/lib/programme.test.js — add near the other describe blocks
describe('addRoutineToProgramme', () => {
  it('appends the routine id to routineIds', () => {
    const prog = { totalWeeks: 2, routineIds: ['a'], weekProgress: {} }
    addRoutineToProgramme(prog, 'b')
    expect(prog.routineIds).toEqual(['a', 'b'])
  })

  it('backfills the new slot as done for weeks that were already fully complete', () => {
    const prog = { totalWeeks: 2, routineIds: ['a'], weekProgress: { 1: [true], 2: [false] } }
    addRoutineToProgramme(prog, 'b')
    expect(prog.weekProgress['1']).toEqual([true, true])  // week 1 was complete — backfilled
    expect(prog.weekProgress['2']).toEqual([false])        // week 2 wasn't — untouched, new slot absent (falsy/pending)
  })

  it('does not mutate weekProgress for a week that had no entry at all (never started, not complete)', () => {
    const prog = { totalWeeks: 3, routineIds: ['a'], weekProgress: { 1: [true] } }
    addRoutineToProgramme(prog, 'b')
    expect(prog.weekProgress['3']).toBeUndefined()
  })

  it('handles totalWeeks: 0 without throwing and without backfilling anything', () => {
    const prog = { totalWeeks: 0, routineIds: ['a'], weekProgress: {} }
    expect(() => addRoutineToProgramme(prog, 'b')).not.toThrow()
    expect(prog.routineIds).toEqual(['a', 'b'])
    expect(prog.weekProgress).toEqual({})
  })

  it('allows adding a routine id that is already present (a routine can occur twice a week)', () => {
    const prog = { totalWeeks: 1, routineIds: ['a'], weekProgress: {} }
    addRoutineToProgramme(prog, 'a')
    expect(prog.routineIds).toEqual(['a', 'a'])
  })

  it('initializes weekProgress when the programme had none at all', () => {
    const prog = { totalWeeks: 1, routineIds: ['a'] }
    expect(() => addRoutineToProgramme(prog, 'b')).not.toThrow()
    expect(prog.routineIds).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix frontend test -- programme.test.js -t addRoutineToProgramme`
Expected: FAIL with `addRoutineToProgramme is not a function` (or import error)

- [ ] **Step 3: Write minimal implementation**

```js
// frontend/src/lib/programme.js — add after rewindProgrammeForDeletedWorkout

// Re-adds a routine to the programme's weekly rotation (e.g. after the user
// removes then reconsiders, or wants a routine twice a week). Weeks that were
// already fully completed before this call are backfilled so the new slot
// doesn't retroactively reopen them — only the current and future weeks show
// it as a pending session.
export function addRoutineToProgramme(prog, routineId) {
  const wasCompleteByWeek = {}
  for (let w = 1; w <= prog.totalWeeks; w++) wasCompleteByWeek[w] = isWeekComplete(prog, w)

  prog.routineIds = [...prog.routineIds, routineId]
  const newIndex = prog.routineIds.length - 1

  prog.weekProgress = prog.weekProgress || {}
  for (let w = 1; w <= prog.totalWeeks; w++) {
    if (!wasCompleteByWeek[w]) continue
    const key = String(w)
    const done = prog.weekProgress[key] ? [...prog.weekProgress[key]] : []
    done[newIndex] = true
    prog.weekProgress[key] = done
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix frontend test -- programme.test.js -t addRoutineToProgramme`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/programme.js frontend/src/lib/programme.test.js
git commit -m "$(cat <<'EOF'
feat: add addRoutineToProgramme, backfilling completed weeks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Top "Créer un programme" CTA, restyled Programmes section

**Files:**
- Modify: `frontend/src/views/Plan.jsx`

**Interfaces:**
- Consumes: `programmeCreateSheet` (already imported, `frontend/src/views/Plan.jsx:9`)
- Produces: nothing new — presentational only

- [ ] **Step 1: Replace the header block's small button and the Programmes section header**

Current (`frontend/src/views/Plan.jsx:72-104`):

```jsx
  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Votre planning hebdomadaire')}</div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TutorialButton steps={PLAN_STEPS} />
        <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    {/* ── Programmes section ── */}
    <div data-tuto="plan-programmes" style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Programmes')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={programmeCreateSheet}>{t('Créer programme')}</Button>
      </div>
      {programmes.length === 0 ? (
```

Replace with:

```jsx
  return <>
    <div className="hdr">
      <div><h1 className="font-display">{t('Plan')}</h1><div className="sub">{t('Votre planning hebdomadaire')}</div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TutorialButton steps={PLAN_STEPS} />
        <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    <button className="btn cta" style={{ marginBottom: 20 }} onClick={programmeCreateSheet}>
      <Icon name="plus" />
      <span>{t('Créer un programme')}</span>
    </button>

    {/* ── Programmes section ── */}
    <div data-tuto="plan-programmes" style={{ marginBottom: 24 }}>
      <h4 className="sec" style={{ margin: '0 0 10px' }}>{t('Programmes')}</h4>
      {programmes.length === 0 ? (
```

(The `Button` import stays — still used by the "Bibliothèque de séances" section until Task 4, and by the starter-plan empty state.)

- [ ] **Step 2: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual: `/plan` — big mint shimmer "Créer un programme" button appears above the Programmes section and opens the same create-programme sheet as before; the small inline button is gone. Both themes, one non-default accent.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/Plan.jsx
git commit -m "$(cat <<'EOF'
feat(design): promote Créer un programme to a top-of-screen CTA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Restyle the "Voir le planning classique" toggle

**Files:**
- Modify: `frontend/src/views/Plan.jsx`

**Interfaces:** none — presentational only

- [ ] **Step 1: Replace the toggle button and its "Masquer" counterpart**

Current (`frontend/src/views/Plan.jsx:106-122`, line numbers shift after Task 2 — locate by content):

```jsx
    {/* ── Week schedule grid (collapsed behind a toggle once a programme is active) ── */}
    {hasActiveProgramme && !showClassic ? (
      <div style={{ marginBottom: 24 }}>
        <button className="chip" onClick={() => setShowClassic(true)}>
          {t('Voir le planning classique')}
        </button>
      </div>
    ) : (
    <div data-tuto="plan-week" style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Week schedule')}</h4>
        {hasActiveProgramme && (
          <button className="chip" style={{ fontSize: 12 }} onClick={() => setShowClassic(false)}>
            {t('Masquer')}
          </button>
        )}
      </div>
```

Replace the two toggle buttons only (everything else in this block — the day grid — is unchanged):

```jsx
    {/* ── Week schedule grid (collapsed behind a toggle once a programme is active) ── */}
    {hasActiveProgramme && !showClassic ? (
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowClassic(true)}
          style={{
            width: '100%', background: 'transparent', border: '1px solid var(--glass-border)',
            color: 'var(--label-2)', fontWeight: 500, fontSize: 13, padding: 11,
            borderRadius: 12, cursor: 'pointer',
          }}
        >
          {t('Voir le planning classique')}
        </button>
      </div>
    ) : (
    <div data-tuto="plan-week" style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Week schedule')}</h4>
        {hasActiveProgramme && (
          <button
            onClick={() => setShowClassic(false)}
            style={{
              background: 'none', border: 'none', padding: '8px 4px', margin: '-8px -4px',
              fontSize: 12, fontWeight: 600, color: 'var(--acc)', cursor: 'pointer',
            }}
          >
            {t('Masquer')}
          </button>
        )}
      </div>
```

(The `margin: '-8px -4px'` hit-area trick matches the fix already applied to `SectionHead`'s action button on the Accueil branch — same rationale: a small text link needs real touch padding without shifting its visual position.)

- [ ] **Step 2: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual: with an active programme, toggle "Voir le planning classique" open and closed — day grid still works exactly as before (day assignment sheet on tap), only the toggle buttons' styling changed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/Plan.jsx
git commit -m "$(cat <<'EOF'
style(design): restyle the classic-planning toggle as an outlined button

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: "Créer une séance" CTA + horizontally-scrollable illustrated routine library

**Files:**
- Modify: `frontend/src/views/Plan.jsx`

**Interfaces:**
- Consumes: `addRoutineToProgramme` (Task 1, from `../lib/programme.js`), `activeProgramme` (already imported), `addRoutine` (already defined in this file), `RoutineCard`'s subtitle logic is not imported — duplicated locally as a small helper (see step 1) since `RoutineCard.jsx`'s `subtitle()` function is not exported and the new tile needs its own markup anyway (two buttons vs. one tap target).
- Produces: `RoutineLibraryRow` component, local to `Plan.jsx`. No exports — this is not reused elsewhere per the spec's Out of Scope.

- [ ] **Step 1: Add a local subtitle helper and the `RoutineLibraryRow` component**

Insert above `export default function Plan()`:

```jsx
function routineTileSubtitle(r) {
  if (isCardioSport(r.sport)) {
    const min = routineTotalDuration(r.blocks || [])
    const label = t(SPORTS[r.sport]?.label || r.sport)
    return min ? `${label} · ${min} min` : label
  }
  const n = r.ex?.length || r.items?.filter(i => i.kind === 'ex').length || 0
  return `${n} ${t('exercices')}`
}

function RoutineLibraryRow({ routines, S, nav, onAddToProgramme, canAdd }) {
  return (
    <div className="no-scrollbar" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 10, paddingBottom: 2 }}>
      {routines.map(r => {
        const isCardio = isCardioSport(r.sport)
        const color = isCardio ? 'var(--teal)' : 'var(--acc)'
        const icon = isCardio ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)
        const hasImg = !!r.imageUrl
        return (
          <div key={r.id} style={{ flex: '0 0 160px', scrollSnapAlign: 'start' }}>
            <div style={{
              position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden',
              border: `2px solid color-mix(in srgb,${color} 40%,transparent)`,
              background: hasImg ? 'var(--surface-2)' : `linear-gradient(135deg,color-mix(in srgb,${color} 22%,var(--surface-2)),var(--surface-3))`,
            }}>
              {hasImg ? (
                <img src={r.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} style={{ fontSize: 34, color, opacity: .45 }} />
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.65) 100%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 9px' }}>
                <div className="capitalize" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.25, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 1, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                  {routineTileSubtitle(r)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
              <button
                className="chip"
                style={{ flex: 1, fontSize: 11, padding: '7px 4px', textAlign: 'center' }}
                onClick={() => nav('/plan/r/' + r.id)}
              >
                {t('Consulter')}
              </button>
              <button
                className="chip"
                disabled={!canAdd}
                style={{ flex: 1, fontSize: 11, padding: '7px 4px', textAlign: 'center', opacity: canAdd ? 1 : .4 }}
                onClick={() => canAdd && onAddToProgramme(r)}
              >
                {t('+ Programme')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Note on the `+ Programme` label:** the spec calls this button "Ajouter au programme"; the tile is only 160px wide with two side-by-side buttons, so the full phrase doesn't fit at a legible size. Use the shorter `+ Programme` label on the button itself, matching the mockup's own abbreviated `+ Plan`; keep `t('Ajouter au programme')` as the toast text in Step 2 where space isn't constrained. This is a presentation-only shortening, not a behavior change — ledger this as a plan deviation if executing under `executing-plans`/`subagent-driven-development`.

- [ ] **Step 2: Wire the CTA and replace the routine grid with the new row**

Current (`frontend/src/views/Plan.jsx:204-224`, locate by content):

```jsx
    {/* ── Routines list ── */}
    <div data-tuto="plan-routines">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Bibliothèque de séances')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('Créer séance')}</Button>
      </div>
      {S.routines.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {S.routines.map(r => (
            <div key={r.id} style={{ width: 'calc(50% - 5px)', flexShrink: 0 }}>
              <RoutineCard routine={r} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('Aucun entrainement pour l\'instant.')}<br />{t('Créez-en un ou chargez le plan de démarrage.')}</div>
          <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
        </>
      )}
    </div>
  </>
}
```

Replace with:

```jsx
    {/* ── Routines list ── */}
    <div data-tuto="plan-routines">
      <h4 className="sec" style={{ margin: '0 0 10px' }}>{t('Bibliothèque de séances')}</h4>
      <button className="btn cta blue" style={{ marginBottom: 14 }} onClick={addRoutine}>
        <Icon name="plus" />
        <span>{t('Créer une séance')}</span>
      </button>
      {S.routines.length ? (
        <RoutineLibraryRow
          routines={S.routines}
          S={S}
          nav={nav}
          canAdd={hasActiveProgramme}
          onAddToProgramme={r => {
            update(s => {
              const prog = activeProgramme(s)
              if (prog) addRoutineToProgramme(prog, r.id)
            })
            useUI.getState().toast(t('Ajouté au programme'))
          }}
        />
      ) : (
        <>
          <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('Aucun entrainement pour l\'instant.')}<br />{t('Créez-en un ou chargez le plan de démarrage.')}</div>
          <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
        </>
      )}
    </div>
  </>
}
```

Add the new import at the top of the file:

```jsx
import { addRoutineToProgramme } from '../lib/programme.js'
```

(merge into the existing `import { isProgrammeComplete, completedWeekCount, activeProgramme } from '../lib/programme.js'` line rather than adding a second import line from the same module)

`RoutineCard` import (`frontend/src/views/Plan.jsx:17`) becomes unused by this screen — remove it. `routineSubtitle` from `../lib/sports.js` (imported line 7) was already unused before this task (confirm at implementation time; if still unused, leave removal out of scope unless it's trivially confirmed dead — don't go hunting beyond this file).

- [ ] **Step 3: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual, `/plan`:
- Blue shimmer "Créer une séance" button opens the same sport-picker flow as before.
- Routine library renders as a horizontally swipeable row of illustrated tiles (image if the routine has one, colored icon fallback otherwise), name + subtitle legible over the scrim.
- With a single routine: no stray scrollbar, row doesn't break.
- "Consulter" navigates to `/plan/r/:id` (existing routine-edit screen), unchanged.
- With an active programme: "+ Programme" is enabled; tapping it appends the routine, shows the "Ajouté au programme" toast, and — for a programme with at least one fully-completed week — that week's `weekProgress` does NOT grow a new pending slot (open the programme's week browser on Home or `programmeEditSheet` to confirm only the current/future weeks show the new session).
- With no active programme: "+ Programme" is visibly disabled (dimmed) and does nothing on tap.
- Both themes, one non-default accent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Plan.jsx
git commit -m "$(cat <<'EOF'
feat(design): replace the routine grid with a scrollable illustrated
library row, add Créer une séance CTA and Ajouter au programme

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Active-programme info banner in `RoutineEdit`

**Files:**
- Modify: `frontend/src/views/RoutineEdit.jsx`

**Interfaces:**
- Consumes: `activeProgramme` (new import from `../lib/programme.js`)
- Produces: nothing new — presentational only

- [ ] **Step 1: Compute programme membership and render the banner**

In `RoutineEdit()`, after `const r = S.routines.find(x => x.id === id)` (`frontend/src/views/RoutineEdit.jsx:291`), add:

```jsx
  const linkedProgramme = activeProgramme(S)
  const inActiveProgramme = !!(linkedProgramme && linkedProgramme.routineIds.includes(id))
```

Add the import at the top of the file:

```jsx
import { activeProgramme } from '../lib/programme.js'
```

Insert the banner right after the header block and its existing `showNameError` banner (`frontend/src/views/RoutineEdit.jsx:416-421`, immediately before the `{/* ── cover image ── */}` comment):

```jsx
    {inActiveProgramme && (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 2px 14px',
        padding: '10px 12px', borderRadius: 10,
        background: 'color-mix(in srgb,var(--acc) 8%,var(--surface-2))',
        border: '1px solid color-mix(in srgb,var(--acc) 22%,transparent)',
      }}>
        <Icon name="info" style={{ fontSize: 15, color: 'var(--acc)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.5 }}>
          {t('Cette séance fait partie du programme actif « {0} ». Toute modification s\'appliquera à ses prochaines occurrences dans le programme.', linkedProgramme.name)}
        </div>
      </div>
    )}
```

If no `info` icon exists in `Icon.jsx` (check at implementation time — grep `frontend/src/components/Icon.jsx` for `info:`), use `circleInfo` or the closest existing equivalent name found there instead; do not invent a new icon glyph for this.

- [ ] **Step 2: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual:
- Open (`Consulter`) a routine that IS in the current active programme's `routineIds` — banner shows, names the programme correctly.
- Open a routine that is NOT in any active programme — no banner, screen looks exactly as before.
- With no active programme at all — no banner for any routine.
- Both themes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/RoutineEdit.jsx
git commit -m "$(cat <<'EOF'
feat(design): warn when editing a routine linked to the active programme

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Manual QA (part of the branch's final review, not a standalone task)

- Full pass on `/plan`: both themes × at least 2 accent colors, on the three CTAs and the new tile row.
- `npm --prefix frontend test` and `npm --prefix frontend run build` both green.
- Confirm the Accueil screen (previous sub-project) still works unaffected — this branch only touches `Plan.jsx`, `RoutineEdit.jsx`, and `lib/programme.js`/its test file, none of which Accueil's own tasks modified except `programme.js` (read-only additions here, no existing exports changed).
