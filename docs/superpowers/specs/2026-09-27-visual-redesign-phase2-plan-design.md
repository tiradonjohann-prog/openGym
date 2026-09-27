# Visual Redesign Phase 2 — Plan Screen Design

**Branch:** `feature/visual-redesign-phase2-plan` (forked from the tip of `feature/visual-redesign-phase2-accueil`)

**Depends on:** Phase 1 foundations (`--glass-fill`/`--glass-border`/`--glass-highlight`/`--glass-shadow`, `.card`, `.btn.cta` + its `.orange`/`.blue` color variants, `.hairline`, `.no-scrollbar`, `.font-display`, the FAB tab-bar) and the Accueil sub-project's `SectionHead` pattern (`frontend/src/views/Home.jsx`) — Plan reuses the same primitives rather than redefining them.

**Mockup source:** `02-Plan.html` (dark) / `02-Plan.html` (light), from the mockup zips. Structural reference: header → big "Créer un programme" CTA → active-programme card → "Voir le planning classique" toggle → "Bibliothèque de séances" list. This screen's spec departs from the mockup in the two places the user explicitly asked for during design review (see Resolved Design Questions).

## Goal

Apply the Phase 1/Accueil visual language to `frontend/src/views/Plan.jsx`: two prominent animated creation CTAs, the existing rich `ProgrammeCard` promoted under a big "Créer un programme" button, and the routine library turned into a horizontally-scrollable row of illustrated tiles carrying two actions each (`Consulter`, `Ajouter au programme`) instead of today's static wrapping 2-column grid. `Ajouter au programme` is genuinely new behavior — re-adding a routine to the active programme's weekly rotation without reopening already-completed weeks — and needs a small, tested pure-logic addition to `lib/programme.js`. `Consulter` reuses the existing routine-edit screen unchanged except for a new informational banner when the routine belongs to an active programme.

## Resolved Design Questions

1. **Routine library layout.** The mockup shows a plain list (icon, name, "+ Plan" pill). The user asked instead to keep the illustrated-tile look (`RoutineCard`'s image/scrim/name treatment, already reused for the Accueil week-carousel) but as a **horizontally swipeable row** rather than a wrapping grid, with **two buttons per tile** (`Ajouter au programme`, `Consulter`) instead of one implicit tap action.
2. **CTA prominence.** Both "Créer un programme" (top of screen) and "Créer une séance" (top of the library section) become full-width animated `.btn.cta` buttons, matching "Démarrer la séance" / "Saisir une activité" on Accueil. Colors are implementer's choice: "Créer un programme" uses the default mint `.btn.cta` (matches the mockup and Accueil's primary action), "Créer une séance" uses the new `.btn.cta.blue` variant (added in this branch's first commit alongside the shimmer-animation fix) so the two creation actions read as distinct from each other and from the orange "Activité supplémentaire" CTA on Accueil.
3. **Adding a routine back to the active programme, without reopening finished weeks.** The programme data model (`lib/programme.js`) applies one fixed `routineIds` array as the weekly template for every week; completion is tracked per week in `weekProgress[weekNum][index]`. Appending a routine naively would add a new pending slot to *every* week, including ones already fully completed — reopening finished weeks. Resolution: a new pure function backfills `weekProgress[week][newIndex] = true` for every week that was already fully complete *before* the append, so only the current (in-progress) week and future weeks show the newly-added session as pending.
4. **Warning on editing a routine that belongs to an active programme.** `RoutineEdit.jsx` auto-saves every field on change — there is no single "save" action to gate a confirmation dialog on. Resolution: a persistent, non-blocking info banner at the top of the screen (shown for the whole edit session, not a one-time interstitial) when the routine being edited is referenced by the current `activeProgramme(S)`'s `routineIds`, explaining that changes apply to that routine's future occurrences in the programme.

## Layout

In visual order:

1. **Header** — unchanged structure (title, subtitle, share icon, settings icon, `TutorialButton`), restyled only for typography (`.font-display` on the "Plan" heading) — no functional change.
2. **`.btn.cta` "Créer un programme"** — full width, top of screen, wired to the existing `programmeCreateSheet` handler (currently the small `variant="tinted"` button next to the "Programmes" heading — this button is removed from there since the top CTA replaces it).
3. **"Programmes" section** — section label kept; if `programmes.length === 0`, keep the existing empty state (icon + copy) below the CTA. If programmes exist, render them exactly as today (`ProgrammeCard` grid, 2 columns when more than one) — `ProgrammeCard` already matches the mockup's image/badge/progress-bar treatment from Phase 1, no changes needed to that component.
4. **"Voir le planning classique" / week-schedule toggle** — same `showClassic` state and conditional rendering already in `Plan.jsx`, restyled: the toggle button becomes a full-width outlined button (`background:transparent`, `border:1px solid var(--glass-border)`) matching the mockup instead of a small `.chip`; the day-grid itself (when shown) keeps its current implementation untouched (it's not part of any mockup screen and nothing about it was flagged).
5. **"Bibliothèque de séances" section:**
   - Section label (unchanged).
   - **`.btn.cta.blue` "Créer une séance"** — full width, wired to the existing `addRoutine` handler (replaces the small `variant="tinted"` "Créer séance" button).
   - **Horizontally-scrollable tile row** (new `RoutineLibraryRow` component local to `Plan.jsx`, structurally mirroring `ProgrammeWeekCarousel`'s scroller div from Home.jsx: `overflowX:auto`, `scrollSnapType:'x mandatory'`, `className="no-scrollbar"`). Each tile:
     - `aspectRatio:'1'`, rounded, `routine.imageUrl` as background with the same bottom-scrim + name-overlay treatment as `RoutineCard`/the Accueil carousel tiles (fallback: colored icon on gradient when no image).
     - Below the image area (or overlaid at the bottom, kept legible against the scrim): two small pill buttons side by side, **Consulter** (navigates to `/plan/r/:id`, existing route) and **Ajouter au programme** (see Behavior below). Tiles are wider than the Accueil carousel's (need room for two buttons) — target ~150-170px.
   - Empty state (no routines yet) unchanged: existing starter-plan prompt.

## Behavior

### "Ajouter au programme"

- Visible on every library tile, regardless of whether the routine is already in the active programme's rotation (re-adding a routine already present is allowed — it becomes a second slot, letting a routine occur twice a week, which is a legitimate existing pattern the app doesn't currently forbid elsewhere either).
- Disabled (or hidden — implementer's call during planning, based on what reads better) when there is no active programme (`activeProgramme(S)` is `null`) — nothing to add to.
- On click: append `routine.id` to `activeProgramme(S).routineIds`, then backfill `weekProgress` for every week that was fully complete *before* the append (see new pure function below), so those weeks don't reopen. A toast confirms ("Séance ajoutée au programme").

### "Consulter"

- Navigates to `/plan/r/:id` (existing `RoutineEdit` route), unchanged.
- `RoutineEdit.jsx` gains one addition: if `activeProgramme(S)?.routineIds.includes(id)`, render an info banner directly under the header (same visual family as the app's other inline info banners — icon + text, no dismiss-forever state needed since it only shows while this specific routine is both open for editing and programme-linked): *"Cette séance fait partie du programme actif « {programme.name} ». Toute modification s'appliquera à ses prochaines occurrences dans le programme."*

## New Pure Logic

**`frontend/src/lib/programme.js`** gains one function, following the file's existing convention of mutating the `prog` object in place (matching `rewindProgrammeForDeletedWorkout`'s pattern — callers already wrap these in the store's `update(s => ...)` immer-style mutator):

```js
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

Call site in `Plan.jsx`: `update(s => { const prog = activeProgramme(s); if (prog) addRoutineToProgramme(prog, routine.id) })`.

## Out of Scope

- No changes to `ProgrammeCard`, `RoutineCard` (the shared component stays as-is; the new library tile is a separate local component in `Plan.jsx`, since it needs two buttons and a different container shape than `RoutineCard`'s single-tap card).
- No changes to the week-schedule day grid's own logic (only its toggle button's visual style).
- No changes to `programmeCreateSheet`, `addRoutine`'s sport-picker flow, `planToolsSheet` — all reused verbatim.
- The "add routine twice in the same week" question (should the UI warn?) is explicitly allowed, not flagged — no new validation.
- `RoutineEdit.jsx` gets only the one banner addition described above; no other changes to that screen (it is its own future Phase 2 sub-project — "Séance" — per the user's confirmed screen order).

## Testing

`addRoutineToProgramme` is new pure logic with real branching (backfill vs. not, based on prior completion) — gets a Vitest unit test in `frontend/src/lib/programme.test.js` (a new file — this module currently has no test file; check for one at plan-writing time before assuming). Everything else in this spec is presentational restructuring or reuse of already-tested/verified functions (`isWeekComplete`, `activeProgramme`, the sheet handlers) — verified manually in the browser per this project's established convention.

## Review Focus

- **`addRoutineToProgramme` on a programme with zero prior routines or `totalWeeks: 0`.** `isWeekComplete` loops `1..totalWeeks`; a malformed/legacy programme with `totalWeeks: 0` must not throw and must simply add the routine with no backfill (no weeks to backfill).
- **Re-adding a routine already at every index.** Appending duplicates is allowed by design (see Behavior) — confirm the UI doesn't accidentally dedupe `routineIds` anywhere downstream (`sessionStates`, `nextSession`) in a way that would silently drop the second occurrence.
- **The `RoutineEdit` banner when `activeProgramme(S)` is `null` or the routine isn't in its `routineIds`.** Must not render — most routines are never in an active programme, this is the common case and must stay silent.
- **Horizontal tile row with a single routine.** `no-scrollbar` + `overflowX:auto` on a row that doesn't overflow must not visually break (no stray scrollbar, no snap-related jump) — same class already proven on Accueil's week carousel, but confirm here since the tile width/count differs.
- **"Ajouter au programme" with no active programme.** Whichever the implementer chooses (disabled vs. hidden) must not leave a dead button that silently no-ops on click — pick one and make it actually correct, not just visually present.
