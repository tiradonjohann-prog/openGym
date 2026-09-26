# Visual redesign — Phase 1 (foundations) design spec

Date: 2026-09-26

## Context

The user commissioned two Claude-generated mockup sets (dark + light, 6
screens each: Accueil, Plan, 3D, Séance, Stats, Nutrition) sketching a new
visual identity for OpenGym Sasoian — a "premium glass" dark/light theme
(Space Grotesk + Sora typography, translucent glass cards, a mint/teal
accent with a gradient-shimmer CTA, a circular floating action button in
the tab bar, and small pulse/flicker micro-animations) to replace the
current "Ganbaru warm dark/oat light" identity.

This is a full-app visual overhaul, not a single-screen task. Per the
user's chosen approach, it's split into two projects:

- **Phase 1 (this spec)**: the shared foundations — design tokens, base
  component classes (`card`, buttons, tab bar/FAB, pill toggles), fonts —
  that every screen will draw on. Scoped to `index.css`, `TabBar.jsx`, and
  `index.html`'s font `<link>`s. No per-screen layout changes.
- **Phase 2 (future, separate spec/plan per screen)**: rolling the
  foundations out screen by screen (Home, Plan, Workout, Stats, Nutrition,
  Anatomy/3D, then the rest of the app — Library, Settings, History,
  RoutineEdit, and the sheets in `sheets.jsx` — which the mockups don't
  cover directly but which inherit the same tokens/components).

Mockup source (extracted, read in full for both themes):
`app-mockup-v-finale.zip` (dark) and `app-mockup-light-v-finale.zip`
(light), both provided by the user.

## Confirmed with the user

- **Both themes stay.** The dark mockup and the light mockup are both
  authoritative — this is not "dark only." Every token below has a
  confirmed value in both.
- **The FAB.** The tab bar's centre "Démarrer" control becomes a raised
  circular floating action button (glowing ring, gradient fill), replacing
  today's wide pill button in that slot. No change to what tapping it does
  (still the Démarrer/Pause/Reprendre state machine) — purely a shape/style
  change to an existing control.
- **The accent-color picker stays.** Settings' existing 8-color accent
  picker (lime/sky/orange/violet/pink/red/teal/gold, via `data-accent` on
  `:root`) is not removed. Mint becomes the new *default* `--acc`, but
  every new component (glass card highlight, FAB gradient, CTA shimmer,
  active-tab dot) must key off `var(--acc)`/`var(--acc-2)` like existing
  components already do, not a hardcoded mint hex — so picking a different
  accent still recolors the new look, the same way it recolors the current
  one.

## Non-goals (Phase 1)

- No per-screen layout changes. Phase 1 touches shared CSS/JS only; every
  view keeps its current structure until its own Phase 2 task.
- No icon *set* replacement. The current `Icon.jsx` library already draws
  at `--icon-stroke:1.7` (already matches the mockups' 1.7–2px stroke
  weight) and is themed via `currentColor`/`var(--label-2)` etc. — that
  already lines up with the mockup's icon language. Redrawing individual
  glyphs to match a specific mockup icon (e.g. the streak flame, the moon)
  is Phase 2, screen-by-screen, not a foundational change.
- No decision here on *which* buttons get the new gradient-shimmer CTA
  treatment app-wide (see §3) — Phase 1 only builds the class; Phase 2
  decides where each screen uses it.

---

## 1. Design tokens — dark theme (`:root`, replacing current Ganbaru values)

| Token | Current | New (mockup dark) |
|---|---|---|
| `--bg` | `#252526` | `#090D16` |
| `--bg-el` | `#2e2e2f` | `#0E1526` (matches mockup's card-gradient dark stop) |
| `--surface` | `#333334` (opaque) | glass: see §2 — no longer a single opaque hex |
| `--surface-2` | `#3c3c3d` | `#111826` (pressed/nested — kept opaque, glass is surface-only) |
| `--surface-3` | `#474748` | `#161F33` |
| `--label` | `#ffffff` | `#E7ECF5` |
| `--label-2` | `rgba(235,235,245,.60)` | `#8492AE` |
| `--label-3` | `rgba(235,235,245,.32)` | `#5B6B85` |
| `--label-4` | `rgba(235,235,245,.18)` | `#4D5C77` |
| `--sep` | `rgba(255,255,255,.10)` | `rgba(255,255,255,.10)` (unchanged — already matches) |
| `--sep-op` | `rgba(255,255,255,.07)` | `rgba(255,255,255,.07)` (unchanged) |
| `--green` (default `--acc`) | `#5cbfa4` | `#7DEFD9` |
| `--acc-2` | `#3d9e88` | `#5FCDB6` |
| `--on-acc` | `#000000` | `#06110E` |
| `--indigo` | `#5e5ce6` | `#8C93F8` (mockup's lavender secondary — also used for `sky`-adjacent links) |
| `--orange` | `#ff9f0a` | `#FFB454` |
| `--r-card` | `14px` | `16px` |

New tokens (additive, needed by §2/§3, don't exist today):

```css
--glass-fill: rgba(255,255,255,.035);
--glass-border: rgba(255,255,255,.09);
--glass-highlight: rgba(255,255,255,.05); /* inset top highlight */
--font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
--font-body: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif;
```

## 2. Design tokens — light theme (`:root[data-theme="light"]`)

| Token | Current | New (mockup light) |
|---|---|---|
| `--bg` | `#F5F0EA` | `#EEF1F6` |
| `--bg-el` | `#FAF6F1` | `#F7F9FC` |
| `--surface-2` | `#ECE7DF` | `#E4E8F0` |
| `--surface-3` | `#E3DDD6` | `#D8DEE9` |
| `--label` | `#1C1812` | `#12141C` |
| `--label-2` | `rgba(58,46,28,.62)` | `#6B7280` |
| `--label-3` | `rgba(58,46,28,.32)` | `#97A1B5` |
| `--sep` | `rgba(58,46,28,.13)` | `rgba(15,23,42,.08)` |
| `--green` (default `--acc`) | `#30A88E` | `#0D9488` |
| `--acc-2` | `#2D8A75` | `#0B7C71` |
| `--indigo` | `#5856D6` | `#4F46E5` |
| `--orange` | `#F07800` | `#D97706` |

New tokens for light:

```css
--glass-fill: #FFFFFF;
--glass-border: rgba(15,23,42,.07);
--glass-highlight: rgba(255,255,255,.9);
```

(Light mode's "glass" is just a clean white card with a soft shadow — the
mockup doesn't use translucency on light backgrounds, it uses it on dark.
`--glass-fill`/`--glass-border`/`--glass-highlight` still exist as the
same-named tokens so `.card`'s CSS in §3 doesn't need a theme branch.)

**Other 6 accent choices (sky/orange/violet/pink/red/gold)**: unchanged in
both themes — the mockups only style the default (mint/teal) accent, so
the existing `data-accent="..."` overrides keep their current hex values.
Only `--green`'s role as the *default* accent changes.

## 3. Base component restyle

**`.card`** (`index.css:203-216`) — from an opaque `--surface` fill to the
glass tokens:

```css
.card{
  background:var(--glass-fill);border-radius:var(--r-card);
  padding:16px;margin-bottom:12px;
  border:1px solid var(--glass-border);
  box-shadow:inset 0 1px 0 var(--glass-highlight);
}
```

Drop the existing `:root[data-theme="light"] .card{...}` override block —
folded into the token difference above (light's `--glass-fill` is already
opaque white, no theme branch needed in the rule itself). Keep `.card.tap`/`.card.tappable`
hover/press behavior unchanged — it already keys off `--surface-2`, which
still exists as a token for that purpose.

**`.btn.primary`** shape: change `border-radius:99px` to `border-radius:14px`
(matches mockup's rounded-rect CTAs, replacing the current full-pill
shape) at `index.css:286`.

**New `.btn.cta` class** (additive, doesn't replace `.btn.primary` — Phase
2 decides per-screen which one to use where a shimmer hero CTA fits):

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

(The gradient stays the literal mockup hex pair in both themes — the
mockups use the identical CTA gradient on dark and light, only the
surrounding shadow color adapts. `box-shadow` uses `color-mix(...,var(--acc)...)`
rather than a hardcoded shadow color so a non-default accent still tints
the glow.)

**Fonts**: add to `frontend/index.html` next to the existing Archivo
`<link>` (`index.html:13-15`):

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Apply in `index.css`: `body{font-family:var(--font-body),...}` (replacing
the current system-font stack — Sora becomes the UI body font everywhere);
add a `.font-display{font-family:var(--font-display)}` utility class for
headings/numbers (`h1`–`h4`, `.big`, `.cf-num`-equivalent stat figures) —
Phase 2 applies it screen by screen rather than a blanket heading-selector
change, since the current codebase sets heading sizes via inline styles in
many places (as seen throughout `Home.jsx`, `Plan.jsx`, etc.) rather than
bare `<h3>` tags picking up a global rule.

## 4. Tab bar / FAB

**`frontend/src/index.css`** `#tabbar` (`:299-325`) and the mockup's
`.cf-nav6`/`.cf-fab-ring`/`.cf-fab` classes get merged into the existing
selectors (`#tabbar button`, `#tabbar button.on`) rather than kept as
separate `cf-`-prefixed classes — this codebase's convention is ID/element
selectors here, not a component class per screen. New rules:

```css
#tabbar{
  /* existing rules unchanged: position, blur, border-top */
  background:color-mix(in srgb,var(--bg-el) 88%,transparent);
}
#tabbar button.start{
  position:relative;margin-top:-24px;
}
#tabbar button.start .cir{
  width:52px;height:52px;border-radius:50%;
  padding:3px;
  background:linear-gradient(150deg,rgba(255,255,255,.5),rgba(255,255,255,.05) 40%,rgba(0,0,0,.35));
  box-shadow:0 10px 18px -6px rgba(0,0,0,.55),0 0 0 5px var(--bg-el);
  display:flex;align-items:center;justify-content:center;
}
#tabbar button.start .cir::before{
  content:'';position:absolute;inset:3px;border-radius:50%;
  background:linear-gradient(165deg,color-mix(in srgb,var(--acc) 60%,#fff) 0%,var(--acc) 55%,var(--acc-2) 100%);
  box-shadow:inset 0 2px 2px rgba(255,255,255,.6),inset 0 -5px 8px rgba(0,0,0,.28);
}
#tabbar button.start .icn{position:relative;color:#06110E}
#tabbar button.start span:not(.cir){display:none} /* FAB carries no text label, per mockup */
```

`TabBar.jsx`'s markup (`:49-52`) needs the icon wrapped in a `.cir` span
(it already wraps the icon in `<span className="cir">`, per the code read
earlier in this project — that markup is reused as-is; only the CSS above
changes its visual treatment) and the text `<span>` hidden rather than
removed, so existing accessibility/label structure is untouched. This is
Phase 1 scope (shared `TabBar.jsx`/`index.css`), tracked as its own task
in the Phase 1 plan.

**Active-tab pulse dot**: add under each non-FAB tab:

```css
@keyframes nav-pulse{0%,100%{opacity:1}50%{opacity:.35}}
#tabbar button.on::after{
  content:'';position:absolute;bottom:2px;width:5px;height:5px;border-radius:50%;
  background:var(--acc);animation:nav-pulse 2.4s ease-out infinite;
}
@media(prefers-reduced-motion:reduce){#tabbar button.on::after{animation:none}}
```

`TabBar.jsx`'s `<button>` elements need `position:relative` (add via the
existing `.on`/base button rule, not inline) for the `::after` dot to
position against.

## 5. Pill toggle (segmented control)

New utility class, additive — used by Nutrition's day/week/bilan tabs and
Stats' 1M/3M toggle in Phase 2, built now since it's a shared primitive:

```css
.pill-toggle{
  font-size:10.5px;font-weight:600;padding:6px 14px;border-radius:999px;
  border:1px solid var(--glass-border);background:transparent;color:var(--label-3);
  transition:background var(--fast),color var(--fast);
}
.pill-toggle.active{background:var(--acc);color:var(--on-acc);border-color:var(--acc)}
```

(This is deliberately close to the existing `.chip`/`.chip.on` pattern
already in `index.css:421+` — introduced as a distinct class rather than
reusing `.chip` because the mockup's toggle is visually flatter/smaller
than the existing chip, and Phase 2 needs to place it in tight header rows
where `.chip`'s current padding doesn't fit. `.chip` itself is untouched.)

---

## Testing

Consistent with this codebase's established convention: no automated
tests for pure visual/CSS changes (`index.css`, font loading) — verified
via `npm run build` (compile check) and manual visual review in both
themes at 320px/desktop widths, screenshotted for the user's sign-off
before Phase 2 begins. `TabBar.jsx`'s markup change (`.cir` wrapping,
label-hiding) gets the same build+manual-check treatment as prior UI-only
work in this project.
