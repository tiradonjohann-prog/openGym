# Visual Redesign Phase 2 — 3D Screen Design

**Branch:** `feature/visual-redesign-phase2-3d` (forked from the tip of `feature/visual-redesign-phase2-plan`)

**Depends on:** Phase 1 foundations (`--glass-fill`/`--glass-border`/`--glass-highlight`, `.font-display`) and the pattern established on Accueil/Plan for headers and pill-badge styling. This screen wraps chrome around an existing real Three.js/React-Three-Fiber scene (`frontend/src/views/AnatomyView.jsx`, `frontend/src/components/anatomy3d/AnatomyModel.jsx`) — no 3D interaction logic changes.

**Mockup source:** `03-3D.html` (dark) / `03-3D.html` (light). The mockup's own "3D body" is a flat illustrative SVG stand-in — this app already has the real thing (an interactive, orbit-controllable GLB model with a muscle heatmap mode), so only the mockup's chrome (header, bottom panel styling) is ported, not its placeholder graphic.

## Goal

Add a header bar to the 3D screen (title, subtitle, settings — currently just a floating back button), restyle the existing muscle/exercise panel with the glass token system, and show a Rive loading animation as a fixed 5-second intro overlay when the screen opens.

## Resolved Design Questions

1. **Header.** The mockup's centered "Explorateur 3D" / "Sélectionne un muscle" header, with the settings icon, is added above the 3D canvas. The mockup's "Face avant" floating badge is explicitly **not** added — this app's camera orbits freely (no discrete front/back view state to report), and showing a static "Face avant" label would misrepresent the current camera angle the moment the user rotates the model.
2. **Loading animation.** The user supplied a Rive animation file (`18699-35150-gym-workout-icons.riv`, in `Downloads`). It plays as a **fixed 5-second intro overlay** on top of the 3D canvas whenever `AnatomyView` mounts, independent of the model's actual load state (simpler and more reliable than coupling it to the GLB's real loading promise, which would require threading a ready-callback through `AnatomyModel`/`useGLTF`'s Suspense boundary — a Suspense `fallback` living inside R3F's `<Canvas>` must be valid Three.js/R3F elements, not an arbitrary DOM component like Rive's `<RiveComponent>`, so a DOM-level timed overlay sitting above the canvas is both simpler and technically necessary here). After 5 seconds the overlay unmounts; the 3D scene underneath has usually finished loading by then (it already shows `FallbackMesh`, a plain grey box, for the rare case it hasn't — unchanged by this spec).
3. **Panel restyle only, no restructuring.** The existing panel (`.anatomy-panel` — already a bottom sheet on mobile, a side panel ≥1000px, already reusing `--r-xl` and safe-area padding) keeps its current structure and behavior (heatmap-exit confirm sheet, "Show more" pagination, exercise tap → `exerciseDetailSheet`). Only its visual treatment changes: glass tokens instead of flat `var(--surface)`, a drag handle on the mobile bottom-sheet variant, and each exercise row's match percentage becomes a small right-aligned pill badge instead of plain subtitle text. The mockup's "Voir tout" link is **not** added — this app has no separate "all exercises for this muscle" screen, and the existing "Show more" pagination already serves that need; adding a dead or redundant link would be inventing UI, not porting one.

## Layout

1. **Header** (new): a `.hdr`-style row above `.anatomy-canvas-wrap` — back chevron (existing handler, `nav(-1)`), centered `t('Explorateur 3D')` (`.font-display`) + `t('Sélectionne un muscle')` subtitle, settings icon (`nav('/settings')`, new — no such affordance exists on this screen today). On the ≥1000px two-column layout (`.anatomy-view{flex-direction:row}`), this header spans the full width above both the canvas and the side panel, matching how Home/Plan's header sits above their content.
2. **Loading overlay** (new): full-bleed, `position:absolute; inset:0; z-index:3` (above the legend's `z-index:2`) over `.anatomy-canvas-wrap`, background matching the canvas's own dark backdrop (`#131519`, already the `<Canvas>` background color) so there's no flash, Rive animation centered, unmounts via a 5000ms `setTimeout` from mount.
3. **Panel restyle**: background becomes `var(--glass-fill)` with `border-top: 1px solid var(--glass-border)` (mobile) / `border-left` (desktop) instead of flat `var(--surface)` + `var(--sep-op)`; add a small centered drag-handle bar (`34×4px`, `var(--label-4)` at low opacity) at the top of the mobile bottom-sheet variant only (the desktop side-panel variant doesn't need one — it isn't a sheet the user drags). The header inside the panel keeps its `h3` muscle name (now `.font-display`) + close button, with the existing "{n} exercises" line kept as-is beneath it. Each list row's trailing element changes from plain `<div className="ss">{pct}%</div>` text to a small pill (`color-mix` accent-tinted background, matching the mockup's percentage chip).

## Out of Scope

- No changes to `AnatomyModel.jsx`, camera focus logic, heatmap mode, the leave-exercise confirm sheet, or the male/female model switch.
- No changes to the exercise-detail navigation (`exerciseDetailSheet`).
- The Rive file is a static asset copied into the repo (`frontend/public/animations/`), not fetched from `Downloads` at runtime.
- No attempt to read or validate the `.riv` file's internal artboard/state-machine names beyond what's needed to play its default animation — if the default Rive component API can't determine a specific animation to play, the implementer uses the package's documented default-artboard/default-animation behavior rather than guessing an internal name.

## Testing

Everything here is presentational/UI wiring (header markup, a CSS restyle, a `setTimeout`-driven overlay toggle) — no new pure logic. Verified manually in the browser per this project's established convention: both themes, the loading overlay appearing and disappearing after 5s, the header's three elements, and the panel's restyled list (open a muscle, confirm the percentage pill and the exercise-count line still read correctly, confirm heatmap mode's leave-confirmation flow still fires unchanged).

## Review Focus

- The 5-second overlay must not block interaction with anything meaningful underneath (nothing critical should be reachable in those first 5 seconds anyway — the model itself is still loading/settling — but confirm the back/settings header buttons remain usable immediately, since header chrome sits outside `.anatomy-canvas-wrap` and isn't covered by the overlay).
- `setTimeout` cleanup on unmount (navigating away from `/anatomy` before 5s elapses) — no state update on an unmounted component.
- The new Rive dependency must not increase the WebGL-unavailable fallback path's bundle weight unnecessarily for users who never reach the 3D screen — confirm it's only pulled into the `/anatomy` route's chunk (this app already code-splits `AnatomyView`, confirmed via the existing `AnatomyView-*.js` chunk seen in build output), not the main bundle.
- Desktop (≥1000px) two-column layout: the new header must not break the existing `.anatomy-view{flex-direction:row}` side-by-side arrangement, and the panel's restyle must look correct in the side-panel variant, not only the mobile bottom-sheet one.
