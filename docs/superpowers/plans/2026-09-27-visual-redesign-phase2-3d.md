# Visual Redesign Phase 2 — 3D Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header bar to `frontend/src/views/AnatomyView.jsx`, restyle its muscle/exercise panel with the glass token system, and show a 5-second Rive loading animation overlay when the screen opens — without touching any 3D interaction logic.

**Architecture:** Three independent, presentation-only changes to one view file plus its stylesheet rules: a new header block, CSS restyling of `.anatomy-panel`/`.anatomy-panel-hdr` plus a new percentage-pill class for exercise rows, and a small new `LoadingIntro` component (new dependency `@rive-app/react-webgl2`) shown as a timed DOM overlay above the `<Canvas>` — never inside it, since a Rive canvas is a plain DOM/WebGL2 element and R3F's `<Suspense>` inside `<Canvas>` can only accept Three.js/R3F children.

**Tech Stack:** React 19, `@react-three/fiber`, `@rive-app/react-webgl2` (new).

**Spec:** `docs/superpowers/specs/2026-09-27-visual-redesign-phase2-3d-design.md`

## Global Constraints

- No changes to `AnatomyModel.jsx`, camera focus logic (`lib/cameraUtils.js`), heatmap mode, the leave-exercise confirm sheet, or the male/female model switch.
- Both themes must keep working — reuse `--glass-fill`/`--glass-border`/`--glass-highlight`/`--acc`/`--label-*` tokens.
- The Rive asset is a static file checked into the repo (`frontend/public/animations/`), never fetched from the user's local `Downloads` folder at runtime.
- French UI strings go through `t(...)`.
- The loading overlay is a fixed 5000ms timer from mount, not coupled to the model's actual load state (per the spec's Resolved Design Questions — this is a deliberate simplification, not an oversight).

## Review Focus

- The 5s overlay must not block the header's back/settings buttons — they sit outside `.anatomy-canvas-wrap`, confirm they're clickable immediately on mount, not just after the overlay clears.
- `setTimeout` must be cleared on unmount (navigating away from `/anatomy` inside the first 5s) — no "set state on unmounted component" warning.
- Confirm `@rive-app/react-webgl2` only lands in the `/anatomy` route's lazy-loaded chunk (already code-split via `React.lazy` in `App.jsx:33`), not the main bundle — check the build output's chunk list.
- The panel restyle must look correct in both the mobile bottom-sheet layout and the ≥1000px side-panel layout (`.anatomy-view{flex-direction:row}` at `index.css:1450`).

---

## Task 1: Header bar (back, centered title/subtitle, settings)

**Files:**
- Modify: `frontend/src/views/AnatomyView.jsx`

**Interfaces:** none — presentational only, reuses `nav(-1)` (already used by the existing back button) and adds `nav('/settings')` (same pattern as Home/Plan's settings icon).

- [ ] **Step 1: Replace the floating back button with a full header row**

Current (`frontend/src/views/AnatomyView.jsx:109-118`):

```jsx
  return (
    <div className="anatomy-view">
      <div
        className="anatomy-canvas-wrap"
        onPointerDown={e => dragGuard.start(e.clientX, e.clientY)}
        onPointerMove={e => dragGuard.check(e.clientX, e.clientY)}
      >
        <button className="iconbtn" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }} onClick={() => nav(-1)} aria-label={t('Back')}>
          <Icon name="chevronLeft" />
        </button>
```

Replace with:

```jsx
  return (
    <div className="anatomy-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px' }}>
        <button className="iconbtn" onClick={() => nav(-1)} aria-label={t('Back')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 15 }}>{t('Explorateur 3D')}</div>
          <div style={{ fontSize: 10.5, color: 'var(--label-3)', marginTop: 1 }}>{t('Sélectionne un muscle')}</div>
        </div>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}>
          <Icon name="gear" />
        </button>
      </div>
      <div
        className="anatomy-canvas-wrap"
        onPointerDown={e => dragGuard.start(e.clientX, e.clientY)}
        onPointerMove={e => dragGuard.check(e.clientX, e.clientY)}
      >
```

(The back button's old absolute-positioned `style` and `zIndex: 2` are dropped — it's now a normal flex child of the header row, not floating over the canvas.)

- [ ] **Step 2: Adjust `.anatomy-view` for the new header row on desktop**

The desktop rule at `frontend/src/index.css:1450` (`.anatomy-view{flex-direction:row}`) makes `.anatomy-view` a row of canvas+panel — the new header row would become a third flex item squeezed into that row instead of spanning above it. Wrap the canvas+panel in their own flex container so the header stays full-width above both:

In `frontend/src/views/AnatomyView.jsx`, after the header `</div>` and before `<div className="anatomy-canvas-wrap" ...>`, add a wrapping `<div className="anatomy-body">`, closing it just before the final closing `</div>` of the component (i.e. it wraps both `.anatomy-canvas-wrap` and the `.anatomy-panel` block, but not the new header).

In `frontend/src/index.css`, change:

```css
.anatomy-view{position:absolute;inset:0;display:flex;flex-direction:column}
```

to:

```css
.anatomy-view{position:absolute;inset:0;display:flex;flex-direction:column}
.anatomy-body{display:flex;flex-direction:column;flex:1;min-height:0}
```

and change the desktop rule from:

```css
.anatomy-view{flex-direction:row}
```

to:

```css
.anatomy-body{flex-direction:row}
```

(`.anatomy-view` stays `flex-direction:column` on desktop too — header on top, `.anatomy-body` row below it.)

- [ ] **Step 3: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual, `/anatomy` (via the tab bar or Home's 3D shortcut):
- Header shows back chevron, centered "Explorateur 3D" / "Sélectionne un muscle", settings gear.
- Back button navigates back exactly as before.
- Settings gear navigates to `/settings`.
- Resize the browser to ≥1000px width — canvas and panel still sit side-by-side below the header, header spans the full width above both. Both themes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/AnatomyView.jsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
feat(design): add header bar to the 3D screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Restyle the muscle/exercise panel

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/views/AnatomyView.jsx`

**Interfaces:** none — presentational only

- [ ] **Step 1: Restyle `.anatomy-panel` and `.anatomy-panel-hdr` with glass tokens, add a drag handle**

Current (`frontend/src/index.css:1396-1408`):

```css
.anatomy-panel{
  flex:0 0 auto;max-height:45vh;overflow-y:auto;
  background:var(--surface);border-top:var(--hair) solid var(--sep-op);
  border-radius:var(--r-xl) var(--r-xl) 0 0;
  padding:14px 16px calc(128px + var(--sab));
  box-shadow:0 -12px 30px -14px rgba(0,0,0,.4);
}
.anatomy-panel-hdr{
  display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;
  position:sticky;top:0;z-index:1;
  background:var(--surface);padding:2px 0 6px;margin-top:-2px;
}
.anatomy-panel-hdr h3{margin:0}
```

Replace with:

```css
.anatomy-panel{
  flex:0 0 auto;max-height:45vh;overflow-y:auto;
  background:var(--glass-fill);border-top:1px solid var(--glass-border);
  border-radius:var(--r-xl) var(--r-xl) 0 0;
  padding:8px 16px calc(128px + var(--sab));
  box-shadow:inset 0 1px 0 var(--glass-highlight),0 -12px 30px -14px rgba(0,0,0,.4);
}
.anatomy-panel-handle{width:34px;height:4px;border-radius:2px;background:var(--label-4);opacity:.4;margin:0 auto 10px}
.anatomy-panel-hdr{
  display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;
  position:sticky;top:0;z-index:1;
  background:var(--glass-fill);padding:2px 0 6px;margin-top:-2px;
}
.anatomy-panel-hdr h3{margin:0}
.anatomy-pct-pill{
  flex:none;font-size:10px;font-weight:700;color:var(--acc);
  background:color-mix(in srgb,var(--acc) 14%,transparent);
  border-radius:999px;padding:3px 8px;
}
```

Add the desktop-only override right after the existing `.anatomy-panel{...}` block inside the `@media (min-width:1000px)` rule (`frontend/src/index.css:1451-1455`) — no handle on the side-panel variant, since it isn't a draggable sheet there:

```css
  .anatomy-panel{
    flex:0 0 340px;max-height:none;height:100%;
    border-top:none;border-left:1px solid var(--glass-border);
    border-radius:0;box-shadow:-12px 0 30px -14px rgba(0,0,0,.4);
  }
  .anatomy-panel-handle{display:none}
```

- [ ] **Step 2: Render the drag handle and swap the inline percentage text for the pill class**

Current (`frontend/src/views/AnatomyView.jsx:163-187`):

```jsx
      {selected && (
        <div className="anatomy-panel">
          <div className="anatomy-panel-hdr">
            <h3>{muscleLabel(selected.muscleKey)}</h3>
            <button className="iconbtn" onClick={deselect} aria-label={t('Close')}>
              <Icon name="xmark" />
            </button>
          </div>
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
```

Replace with:

```jsx
      {selected && (
        <div className="anatomy-panel">
          <div className="anatomy-panel-handle" />
          <div className="anatomy-panel-hdr">
            <h3 className="font-display">{muscleLabel(selected.muscleKey)}</h3>
            <button className="iconbtn" onClick={deselect} aria-label={t('Close')}>
              <Icon name="xmark" />
            </button>
          </div>
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
                </div>
                <span className="anatomy-pct-pill">{ex.exercise_muscles[selected.muscleKey]}%</span>
                <Icon name="chevronRight" className="chev" />
              </div>
            ))}
            {list.length === 0 && <div className="empty">{t('No exercises found for this muscle.')}</div>}
          </div>
```

- [ ] **Step 3: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual, `/anatomy`:
- Tap a muscle on the model — panel slides in with the drag handle at top (mobile width), muscle name in the display font, close button works exactly as before.
- Each exercise row shows a small accent-tinted percentage pill before the chevron, name no longer has the percentage stacked underneath it.
- "Show more" pagination still works.
- Tapping an exercise still opens `exerciseDetailSheet`.
- ≥1000px width: side-panel variant has no drag handle, otherwise same restyle.
- Both themes, one non-default accent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/views/AnatomyView.jsx
git commit -m "$(cat <<'EOF'
style(design): restyle the 3D screen's muscle panel with glass tokens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 5-second Rive loading intro

**Files:**
- Add dependency: `@rive-app/react-webgl2` (`npm --prefix frontend install @rive-app/react-webgl2`)
- Create: `frontend/public/animations/gym-workout-icons.riv` (copied from `C:\Users\Johann\Downloads\18699-35150-gym-workout-icons.riv`)
- Create: `frontend/src/components/anatomy3d/LoadingIntro.jsx`
- Modify: `frontend/src/views/AnatomyView.jsx`

**Interfaces:**
- Produces: `LoadingIntro` — a self-contained component with no props, renders the Rive animation full-bleed. Mounted/unmounted by `AnatomyView`'s own timer state — `LoadingIntro` itself doesn't manage the 5s timing (keeps the timing decision in the view, the component dumb and reusable).

- [ ] **Step 1: Install the dependency**

Run: `npm --prefix frontend install @rive-app/react-webgl2`
Expected: adds `@rive-app/react-webgl2` to `frontend/package.json` dependencies, installs cleanly (React 19 is within its documented supported range, `^16.8.0` through `^19.0.0`).

- [ ] **Step 2: Copy the Rive asset into the repo**

```bash
mkdir -p frontend/public/animations
cp "C:\Users\Johann\Downloads\18699-35150-gym-workout-icons.riv" "frontend/public/animations/gym-workout-icons.riv"
```

(Use the copy without the `(1)` suffix, or either — they're identical file sizes per a prior `ls`; confirm with `diff` if both are present and sizes match before picking one, to avoid guessing which is current.)

- [ ] **Step 3: Write `LoadingIntro`**

```jsx
// frontend/src/components/anatomy3d/LoadingIntro.jsx
import { useRive } from '@rive-app/react-webgl2'

// Full-bleed Rive animation shown for a fixed duration while the 3D screen
// opens — AnatomyView owns the 5s timer, this component just plays.
export default function LoadingIntro() {
  const { RiveComponent } = useRive({
    src: '/animations/gym-workout-icons.riv',
    autoplay: true,
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 3,
      background: '#131519', // matches the <Canvas> background — no flash when it unmounts
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 160, height: 160 }}>
        <RiveComponent />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the 5s timer into `AnatomyView` and render the overlay**

Add the import near the top of `frontend/src/views/AnatomyView.jsx` (with the other component imports):

```jsx
import LoadingIntro from '../components/anatomy3d/LoadingIntro.jsx'
```

Add state and a cleanup-safe timer inside `AnatomyView`, alongside the existing `useState` calls (after `const [shown, setShown] = useState(30)`, before `const handleMuscleClick = ...`):

```jsx
  const [showIntro, setShowIntro] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setShowIntro(false), 5000)
    return () => clearTimeout(id)
  }, [])
```

Add `useEffect` to the existing React import at the top of the file (`frontend/src/views/AnatomyView.jsx:2`):

```jsx
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
```

Render the overlay inside `.anatomy-canvas-wrap`, after the back-button/header markup Task 1 already moved out of this div, right before the `{effectiveHeatmap && ...}` legend block:

```jsx
      <div
        className="anatomy-canvas-wrap"
        onPointerDown={e => dragGuard.start(e.clientX, e.clientY)}
        onPointerMove={e => dragGuard.check(e.clientX, e.clientY)}
      >
        {showIntro && <LoadingIntro />}
        {effectiveHeatmap && (
```

- [ ] **Step 5: Manual verification**

Run: `npm --prefix frontend run build`
Expected: build succeeds
Manual:
- Open `/anatomy` — Rive animation plays full-bleed over the canvas immediately.
- After 5 seconds, the overlay disappears and the 3D model (already loaded underneath) is revealed.
- The header's back/settings buttons work immediately, even while the overlay is showing (they're outside `.anatomy-canvas-wrap`).
- Navigate away from `/anatomy` (tap another tab) within the first 5 seconds — no console warning about setting state on an unmounted component.
- Run `npm --prefix frontend run build` and check `dist/assets/` — confirm `@rive-app/react-webgl2`'s code appears only in the `AnatomyView-*.js` chunk (or a chunk pulled in only by it), not in `index-*.js` (the main bundle). If it leaks into the main chunk, that's a Critical-tier regression for this plan's Review Focus — investigate before considering this task done (likely fix: ensure `LoadingIntro.jsx` has no import path back into anything eagerly loaded from `App.jsx`).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/public/animations/gym-workout-icons.riv frontend/src/components/anatomy3d/LoadingIntro.jsx frontend/src/views/AnatomyView.jsx
git commit -m "$(cat <<'EOF'
feat(design): add a 5s Rive loading intro to the 3D screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Manual QA (part of the branch's final review, not a standalone task)

- Full pass on `/anatomy`: both themes × at least 2 accent colors, header, panel, and the loading overlay.
- `npm --prefix frontend test` and `npm --prefix frontend run build` both green.
- Confirm the heatmap mode (arriving from an exercise's "muscles worked" view) still shows its legend and leave-confirmation flow correctly with the new header/overlay in place.
