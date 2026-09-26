# Visual Redesign Phase 1 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OpenGym Sasoian's shared visual foundations (color/surface/
typography tokens in both themes, the `.card` base style, primary buttons,
the tab bar's FAB, and one new pill-toggle primitive) with the new
"premium glass" identity from the two Claude-generated mockup sets — no
per-screen layout changes, those are Phase 2.

**Architecture:** Every change lives in three files: `frontend/index.html`
(font `<link>`), `frontend/src/index.css` (tokens + base component CSS),
and `frontend/src/components/TabBar.jsx` (FAB markup only — its click
logic is untouched). All new/changed CSS keys off existing custom
properties (`var(--acc)`, `var(--acc-2)`, `var(--on-acc)`, etc.) so the
existing 8-color accent picker keeps working against the new look.

**Tech Stack:** Plain CSS custom properties, no build tooling changes, no
new dependency (fonts load via the same Google Fonts `<link>` pattern
already used for Archivo).

**Spec:** `docs/superpowers/specs/2026-09-26-visual-redesign-phase1-foundations-design.md`

## Global Constraints

- No per-screen JSX/layout changes — everything here is shared
  tokens/base-component CSS plus the one `TabBar.jsx` markup tweak the
  spec calls out. Views inherit the new look automatically through
  existing classes (`.card`, `.btn`, `#tabbar`); none of them are touched
  directly in this plan.
- Every new color value must be reachable through an existing or newly
  introduced CSS custom property — never a bare hex baked into a rule
  that should react to the user's chosen accent (`data-accent="..."`).
  The CTA gradient (§3 of the spec) is the one deliberate, spec-confirmed
  exception: its two gradient stops are the literal mockup hex pair in
  both themes, not accent-derived — only its shadow color is
  accent-derived.
- The existing 6 non-default accents (sky/orange/violet/pink/red/gold)
  keep their current hex values — only `--green` (the default accent) and
  the neutral surface/label ramp change.
- No automated tests for this plan — consistent with this codebase's
  established convention (previous branches), CSS/token changes are
  verified via `npm run build` (compile check) plus manual visual review
  in both themes, screenshotted for the user's sign-off in the final task.

## Review Focus

- **A user with a non-default accent color** (e.g. `data-accent="sky"`)
  loads the app after this change — the glass card, FAB, and active-tab
  dot must recolor to blue, not stay hardcoded mint. Covered in Task 7's
  manual check (switch accent in Settings, re-check the tab bar and a
  card).
- **`prefers-reduced-motion: reduce`** — the new CTA shimmer and the
  active-tab pulse dot both add continuous-loop animations; a user with
  this preference must not get either. Covered in Tasks 5 and 7.
- **Light theme parity** — every token in Task 3 must actually be read
  somewhere (no light-mode value defined but never applied because a
  component only reads the dark-mode custom property name). Covered in
  Task 8's dual-theme visual pass.
- **The tab bar's existing "recording" (`.rec`) state** — the FAB already
  distinguishes an active workout (orange disc + pulsing ring) from idle
  (accent-colored disc); Task 7 must preserve this distinction under the
  new gradient/ring treatment, not silently drop it.
- **Buttons that use `.btn.primary` outside the pill shape it's had until
  now** — changing its `border-radius` from `99px` to `14px` is global;
  confirm no existing inline style anywhere assumes/overrides a fully
  round pill in a way that now looks broken (e.g. a `width`/`height`
  equal, circular-icon-only primary button, if any exist). Covered in
  Task 5's manual check across a few existing screens.

---

## Task 1: Load the new fonts

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

**Interfaces:** produces `--font-display` and `--font-body` custom
properties, consumed by Task 2/3 (defined alongside the token blocks) and
by `body`'s font-family here.

- [ ] **Step 1: Add the Space Grotesk + Sora font link**

In `frontend/index.html`, add a new `<link>` right after the existing
Archivo one (`index.html:15`):

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@900&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet">
```

(The existing `preconnect` hints at `:13-14` already cover
`fonts.googleapis.com`/`fonts.gstatic.com` — no new preconnect needed.)

- [ ] **Step 2: Apply the body font**

In `frontend/src/index.css`, `body`'s font stack currently reads
(`:100-108`, approximate — search for the `body{` rule with
`font-family:-apple-system,...`):

```css
body{
  background:var(--bg);color:var(--label);
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Segoe UI',Roboto,system-ui,sans-serif;
  ...
}
```

Change the `font-family` line to:

```css
  font-family:var(--font-body),-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Segoe UI',Roboto,system-ui,sans-serif;
```

(`--font-body` is defined in Task 2 — this task's font-family change
compiles fine either way since an undefined custom property is simply
ignored by the browser and the fallback stack still applies, but Task 2
should land in the same session before calling this done, per this plan's
numeric order.)

- [ ] **Step 3: Manual verification**

`npm run build` from `frontend/` — confirm it compiles (a `<link>` tag and
a font-family swap can't fail the build, this just confirms no stray
syntax error). Visual confirmation of the font actually rendering happens
naturally in Task 8's full review, once `--font-body` exists.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "feat(design): load Space Grotesk and Sora fonts"
```

---

## Task 2: Dark theme tokens

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** replaces values in the existing `:root{...}` block
(`index.css:20-63`); produces `--glass-fill`, `--glass-border`,
`--glass-highlight`, `--font-display`, `--font-body` (new tokens, dark
values) consumed by Tasks 4-7.

- [ ] **Step 1: Replace the dark-theme color values**

In `frontend/src/index.css`'s `:root{...}` block, change these existing
declarations (leave every other line — geometry, motion, `--sab`/`--sat`,
every other accent hex — untouched):

```css
  --bg:        #090D16;
  --bg-el:     #0E1526;
  --surface-2: #111826;
  --surface-3: #161F33;

  --label:     #E7ECF5;
  --label-2:   #8492AE;
  --label-3:   #5B6B85;
  --label-4:   #4D5C77;
```

```css
  --blue:#0a84ff; --green:#7DEFD9; --red:#ff453a; --orange:#FFB454;
  --yellow:#ffd60a; --teal:#40c8e0; --indigo:#8C93F8; --pink:#ff375f;
  --purple:#bf5af2; --mint:#7DEFD9; --brown:#ac8e68; --grey:#8e8e93;
```

```css
  --acc-2:#5FCDB6;
  --on-acc:#06110E;
```

`--r-card` moves from `14px` to `16px` — this is in the `geometry` line
(`--r-sm:8px; --r:12px; --r-lg:16px; --r-xl:22px; --r-card:14px;`), change
only the `--r-card` value:

```css
  --r-sm:8px; --r:12px; --r-lg:16px; --r-xl:22px; --r-card:16px;
```

Leave `--sep`/`--sep-op` unchanged (spec confirms they already match).

- [ ] **Step 2: Add the new glass/font tokens**

In the same `:root{...}` block, add a new group after the existing
`accent (per-account, synced)` group (after the `--acc-line` line):

```css
  /* glass surface (Phase 1 visual redesign) */
  --glass-fill: rgba(255,255,255,.035);
  --glass-border: rgba(255,255,255,.09);
  --glass-highlight: rgba(255,255,255,.05);

  /* typography (Phase 1 visual redesign) */
  --font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;
```

- [ ] **Step 3: Manual verification**

`npm run build` — confirm it compiles. Full visual confirmation is Task
8; this step alone is a compile check since nothing consumes the new
glass tokens yet (Task 4 does).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design): update dark-theme tokens to the new visual identity"
```

---

## Task 3: Light theme tokens

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** replaces/adds values in the existing
`:root[data-theme="light"]{...}` block (`index.css:65-80`); produces the
same `--glass-*` token names as Task 2, with light values — every consumer
(Tasks 4-7) reads the same property names regardless of theme.

- [ ] **Step 1: Replace the light-theme color values**

In `frontend/src/index.css`'s `:root[data-theme="light"]{...}` block,
change:

```css
  --bg:        #EEF1F6;
  --bg-el:     #F7F9FC;
  --surface-2: #E4E8F0;
  --surface-3: #D8DEE9;

  --label:     #12141C;
  --label-2:   #6B7280;
  --label-3:   #97A1B5;

  --sep:       rgba(15,23,42,.08);
  --sep-op:    rgba(15,23,42,.06);
```

(`--sep-op` didn't have a documented mockup value — derive it the same
way the existing block does, roughly 3/4 the opacity of `--sep`, matching
the existing dark-theme `--sep`/`--sep-op` ratio of `.10`/`.07`.)

```css
  --blue:#0071E3; --green:#0D9488; --red:#FF3B30; --orange:#D97706;
  --yellow:#E6A800; --teal:#28B0C7; --indigo:#4F46E5; --pink:#FF2D55;
  --purple:#AF52DE; --mint:#0D9488; --brown:#A2845E; --grey:#8E8E93;
  --acc-2:#0B7C71;
```

(`--on-acc` and `--label-4` are not respecified by the mockup's light
palette — leave the existing light-theme `--on-acc:#000000` and
`--label-4` (inherited from `:root` since the light block doesn't
override it today — confirm this by reading the block before editing;
if it turns out `--label-4` has no light-specific line today, still add
none — the dark value inherits, matching current behavior for this one
token.)

- [ ] **Step 2: Add the light glass tokens**

In the same block, add (mirroring Task 2's new-token group, light
values):

```css
  /* glass surface (Phase 1 visual redesign) */
  --glass-fill: #FFFFFF;
  --glass-border: rgba(15,23,42,.07);
  --glass-highlight: rgba(255,255,255,.9);
```

(No light-specific `--font-display`/`--font-body` needed — those are
theme-independent, already defined once in `:root` by Task 2.)

- [ ] **Step 3: Manual verification**

`npm run build`. With `npm run dev`, toggle to light mode in Settings and
confirm the app still renders (background/text colors visibly shift to
the new light palette even though `.card` doesn't consume `--glass-*` yet
— that's Task 4). Confirm no console errors from the theme toggle.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design): update light-theme tokens to the new visual identity"
```

---

## Task 4: `.card` glass restyle

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** consumes `--glass-fill`/`--glass-border`/`--glass-highlight`
(Tasks 2/3). Produces no new tokens — this is the first task where the
new look becomes visible, since `.card` is used throughout every screen
already shipped.

- [ ] **Step 1: Replace `.card`'s fill with the glass tokens**

In `frontend/src/index.css`, the current rule (`:203-216`):

```css
.card{
  background:var(--surface);border-radius:var(--r-card);
  padding:16px;margin-bottom:12px;
  border:1px solid rgba(255,255,255,.07);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
}
:root[data-theme="light"] .card{
  border-color:rgba(0,0,0,.09);
  box-shadow:0 1px 3px rgba(0,0,0,.06), 0 1px 1px rgba(0,0,0,.04);
}
```

becomes:

```css
.card{
  background:var(--glass-fill);border-radius:var(--r-card);
  padding:16px;margin-bottom:12px;
  border:1px solid var(--glass-border);
  box-shadow:inset 0 1px 0 var(--glass-highlight);
}
```

(The `:root[data-theme="light"] .card{...}` override block is deleted
entirely — light's `--glass-fill` is already opaque white with its own
border/highlight tokens from Task 3, so the theme-specific override that
used to hand-tune light mode's shadow is no longer needed; the base rule
now produces the correct look in both themes via tokens alone.)

Leave `.card.tap`/`.card.tappable` and their `:active`/`:hover` rules
(`:214-216`) untouched — they already key off `--surface-2`, which still
exists as a token (updated in Tasks 2/3, but the rule referencing it is
unchanged).

- [ ] **Step 2: Manual verification**

`npm run build`. With `npm run dev`, open Home in both themes — confirm
cards now show the translucent/glass look (dark: faint white wash over
the dark background with a soft top highlight; light: clean white card
with a soft shadow, no visible regression from before). Spot-check one
screen with many stacked cards (e.g. Stats) for consistency.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design): restyle .card with the new glass surface tokens"
```

---

## Task 5: Primary buttons — shape change + new `.btn.cta`

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** produces the `.btn.cta` class (additive — `.btn.primary`
still exists unchanged in behavior, only its corner radius changes).
Neither is consumed by any other task in this plan — Phase 2 decides
per-screen which class each button uses.

- [ ] **Step 1: Change `.btn.primary`'s shape**

In `frontend/src/index.css` (`:286`):

```css
.btn.primary{background:var(--acc);color:var(--on-acc);border-radius:99px}
```

becomes:

```css
.btn.primary{background:var(--acc);color:var(--on-acc);border-radius:14px}
```

- [ ] **Step 2: Add the `.btn.cta` shimmer class**

Add after the existing `.btn` rule block (near `:296`, after
`.btn:disabled{opacity:.32;pointer-events:none}`):

```css
@keyframes cta-sweep{0%{transform:translateX(-130%) skewX(-18deg)}55%,100%{transform:translateX(230%) skewX(-18deg)}}
.btn.cta{
  position:relative;overflow:hidden;
  background:linear-gradient(160deg,#8FF0DF,#5FCDB6);
  color:#06110E;border-radius:14px;
  box-shadow:0 8px 20px -6px color-mix(in srgb,var(--acc) 55%,transparent),inset 0 1px 0 rgba(255,255,255,.5);
}
.btn.cta::before{
  content:'';position:absolute;top:0;left:0;width:36%;height:100%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);
  animation:cta-sweep 4.5s ease-in-out infinite;
}
@media(prefers-reduced-motion:reduce){.btn.cta::before{animation:none}}
```

- [ ] **Step 3: Manual verification**

`npm run build`. With `npm run dev`, visit a few existing screens that use
`.btn.primary` (e.g. Plan's "Load starter plan" button, a sheet's save
button) — confirm they now render as rounded rectangles instead of full
pills, and nothing looks visually broken (no button that assumed a fully
circular/pill shape now clips oddly). `.btn.cta` isn't used anywhere yet
(Phase 2 wires it up per-screen) — verify it compiles cleanly by
temporarily adding `cta` to one button's `className` in the browser
devtools (not committed) to eyeball the shimmer, then revert.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design): change .btn.primary to rounded-rect, add .btn.cta shimmer variant"
```

---

## Task 6: `.pill-toggle` primitive

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** produces `.pill-toggle`/`.pill-toggle.active` — unused
until Phase 2 wires it into Nutrition's tabs / Stats' range toggle.

- [ ] **Step 1: Add the class**

Add near the existing `.chip`/`.chip.on` rules (`index.css:421+`):

```css
.pill-toggle{
  font-size:10.5px;font-weight:600;padding:6px 14px;border-radius:999px;
  border:1px solid var(--glass-border);background:transparent;color:var(--label-3);
  transition:background var(--fast),color var(--fast);
}
.pill-toggle.active{background:var(--acc);color:var(--on-acc);border-color:var(--acc)}
```

- [ ] **Step 2: Manual verification**

`npm run build`. No visual check possible yet (unused class) — this is a
compile-only step; Phase 2's first screen to use it gets the real visual
check.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design): add .pill-toggle primitive"
```

---

## Task 7: Tab bar FAB refinement + active-tab pulse dot

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/TabBar.jsx`

**Interfaces:** consumes `--acc`/`--acc-2`/`--on-acc`/`--bg-el` (Tasks
2/3). No new exports — leaf UI refinement building on the existing
`#tabbar button.start` rules and `TabBar.jsx`'s existing `.cir`-wrapped
markup (unchanged from the previous branch's pause/resume work).

- [ ] **Step 1: Give the FAB the new elevated-ring look**

The current rules (`index.css:328-349`):

```css
#tabbar button.start{margin-top:-20px;flex:none;padding:0}
#tabbar button.start .cir{
  width:52px;height:52px;border-radius:50%;background:var(--acc);color:var(--on-acc);
  display:flex;align-items:center;justify-content:center;position:relative;
  box-shadow:0 6px 18px -4px color-mix(in srgb,var(--acc) 55%,transparent);
  transition:transform var(--fast) var(--ease);
}
#tabbar button.start:active .cir{transform:scale(.93)}
#tabbar button.start .cir .icn{font-size:26px;--icon-stroke:2;color:inherit;opacity:1}
#tabbar button.start span{color:var(--acc);font-weight:600}
#tabbar button.start .cir{color:var(--on-acc)}
#tabbar button.start.rec .cir{background:var(--orange);color:#000;box-shadow:0 6px 18px -4px color-mix(in srgb,var(--orange) 55%,transparent)}
#tabbar button.start.rec span{color:var(--orange)}
#tabbar button.start.rec .cir::after{
  content:'';position:absolute;inset:0;border-radius:50%;
  border:2px solid var(--orange);animation:ping 1.9s var(--ease) infinite;
}
```

become:

```css
#tabbar button.start{margin-top:-24px;flex:none;padding:0}
#tabbar button.start .cir{
  width:58px;height:58px;border-radius:50%;padding:3px;position:relative;
  background:linear-gradient(150deg,rgba(255,255,255,.5),rgba(255,255,255,.05) 40%,rgba(0,0,0,.35));
  box-shadow:0 10px 18px -6px rgba(0,0,0,.45),0 0 0 5px var(--bg-el);
  display:flex;align-items:center;justify-content:center;
  transition:transform var(--fast) var(--ease);
}
#tabbar button.start .cir::before{
  content:'';position:absolute;inset:3px;border-radius:50%;
  background:linear-gradient(165deg,color-mix(in srgb,var(--acc) 55%,#fff) 0%,var(--acc) 55%,var(--acc-2) 100%);
  box-shadow:inset 0 2px 2px rgba(255,255,255,.6),inset 0 -5px 8px rgba(0,0,0,.28);
}
#tabbar button.start:active .cir{transform:scale(.93)}
#tabbar button.start .cir .icn{font-size:22px;--icon-stroke:2;color:var(--on-acc);position:relative;z-index:1}
#tabbar button.start .lbl{display:none}
#tabbar button.start.rec .cir::before{background:var(--orange)}
#tabbar button.start.rec .cir .icn{color:#000}
#tabbar button.start.rec .cir::after{
  content:'';position:absolute;inset:3px;border-radius:50%;
  border:2px solid var(--orange);animation:ping 1.9s var(--ease) infinite;
}
```

(The `.rec` orange "recording" treatment is preserved — it now paints
onto the `::before` gradient layer and the ring `::after` inset shrinks
from `0` to `3px` to sit just inside the new outer ring instead of on the
button's outer edge, matching the ring's new proportions. The label span
is hidden via a dedicated `.lbl` class rather than a bare `span` selector,
added in Step 2, so this rule can't accidentally hide the `.cir` icon
too — both are `<span>` elements.)

Also update the `@media (min-width:1000px)` desktop override
(`index.css:1386`, currently `#tabbar button.start{margin-top:-26px}`) to
match the new base offset proportionally:

```css
#tabbar button.start{margin-top:-30px}
```

- [ ] **Step 2: Mark the FAB's label span, add an aria-label**

In `frontend/src/components/TabBar.jsx`, the start button currently reads:

```jsx
<button className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
  <span className="cir"><Icon name={S.active ? (S.active.pausedAt ? 'play' : 'pause') : 'dumbbell'} /></span>
  <span>{S.active ? (S.active.pausedAt ? t('Reprendre') : t('Pause')) : t('Start')}</span>
</button>
```

Add `className="lbl"` to the second span, and an `aria-label` on the
button so the now visually-hidden text stays available to assistive tech
(the mockup shows no label text under the FAB, but removing it from the
DOM/accessible-name entirely would be a regression):

```jsx
<button
  className={'start' + (S.active ? ' rec' : '')}
  onClick={startWorkout}
  aria-label={S.active ? (S.active.pausedAt ? t('Reprendre') : t('Pause')) : t('Start')}
>
  <span className="cir"><Icon name={S.active ? (S.active.pausedAt ? 'play' : 'pause') : 'dumbbell'} /></span>
  <span className="lbl">{S.active ? (S.active.pausedAt ? t('Reprendre') : t('Pause')) : t('Start')}</span>
</button>
```

- [ ] **Step 3: Add the active-tab pulse dot**

In `frontend/src/index.css`, add after the existing `#tabbar button.on`
rule (`:315-319`):

```css
@keyframes nav-pulse{0%,100%{opacity:1}50%{opacity:.35}}
#tabbar button.on{position:relative}
#tabbar button.on::after{
  content:'';position:absolute;bottom:1px;width:5px;height:5px;border-radius:50%;
  background:var(--acc);animation:nav-pulse 2.4s ease-out infinite;
}
@media(prefers-reduced-motion:reduce){#tabbar button.on::after{animation:none}}
```

(`#tabbar button` already establishes `flex-direction:column;align-items:center`,
so the dot centers under the tab's label without extra positioning; the
existing `.tab-pill` wrapper used for the active label styling is
untouched, this only adds a dot beneath the whole button.)

- [ ] **Step 4: Manual verification**

`npm run build`. With `npm run dev`:
- Confirm the FAB shows a layered, glossy circular gradient with a raised
  ring, no visible text label, and an accessible name (inspect via
  devtools' accessibility tree, or a screen reader if available).
- Start a workout — confirm the `.rec` state still turns the FAB orange
  with the pulsing ring, same as before this task.
- Confirm every other tab shows a small pulsing dot under its label when
  active, and no dot when inactive.
- In Settings, switch the accent color to something other than the
  default (e.g. `sky`) — confirm the FAB's gradient and the active-tab
  dot both recolor to the new accent, not stuck on mint (Review Focus
  item).
- Confirm the desktop (`≥1000px`) layout still positions the FAB
  correctly relative to the floating tab bar pill.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/components/TabBar.jsx
git commit -m "feat(design): refine tab-bar FAB to the new elevated-ring look, add active-tab pulse dot"
```

---

## Task 8: Full dual-theme visual review

**Files:** none — verification only.

- [ ] **Step 1: Run the full build and test suite one more time**

```bash
npm run build --prefix frontend
npm run test --prefix frontend
```

Expected: build succeeds, all existing tests still pass (no CSS/markup
change in this plan touches any tested pure-logic function).

- [ ] **Step 2: Screenshot both themes for the user's sign-off**

With `npm run dev`, walk Home, Plan, Stats, and one sheet (e.g. the
exercise detail sheet) in both dark and light mode. Confirm:
- Cards read as glass/translucent (dark) or clean white (light), not a
  mix of old and new surfaces anywhere.
- Body text renders in Sora, numbers/headings that use `.font-display`
  (none yet — Phase 2 applies it per-screen) still read fine in the
  inherited body font in the meantime.
- The FAB and active-tab dot behave as verified in Task 7.
- No layout breakage (overlapping text, clipped buttons) introduced by
  the `--r-card`/`.btn.primary` radius changes.

Save screenshots (or note observations) to report back to the user —
this task's output is the sign-off gate before Phase 2 (per-screen
rollout) gets its own spec and plan.

- [ ] **Step 3: Report findings**

Summarize what was verified and any visual rough edges spotted (expected
— Phase 1 only changes shared foundations, so some screens may look
"half-migrated" against old inline styles until their own Phase 2 task
lands) back to the user before proposing Phase 2's scope.
