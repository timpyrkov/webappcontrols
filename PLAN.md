# Volume Style — Pseudo-3D Niche Effect Plan

## Scope

This plan covers **only the Volume style mode**. Other style modes
(Flat, Gradient, Basic) must remain **completely untouched**.

Volume = Gradient + two distinctive features:
- **(a) Lighter bevels** on raised elements (push buttons, segment thumb,
  toggle thumb, slider thumb). Already mostly implemented via the
  `--btn-overlay` / `::before` mechanism in `flat.js`. Refinements only.
- **(b) Dashboard niches** around interactive elements — recessed pockets
  cut into the panel that the buttons sit inside. **This is the focus of
  the new work.**

---

## Problems with the Current Niche

Reviewing the current screenshot and `volume.css`, the niche has four
qualitative defects:

1. **Niche edges fade together with disabled state.**
   `:host([disabled]) { opacity: 0.38 }` in `flat.js` dims the entire
   custom element — including the niche shadow. Wrong: a niche is part
   of the dashboard, not the button. The dashboard never disables.

2. **Niche too dark in light theme.**
   The current `--shadow-btn` uses `rgba(0,0,0,0.5)` in both themes.
   On a light panel a black halo looks artificial. Light theme needs
   a softer dark + visible white reflection (classic
   "depression-on-light-surface").

3. **Shadow spreads too far.**
   `0 0 6px 1px` and `0 0 3px 1px` produce a wide diffuse halo. A real
   recessed pocket is shallow and tight: 1–2 px lines, no halo.

4. **Mid-tone shadow color (muddy gray).**
   `rgba(0,0,0,0.5)` on a near-black panel renders as a dim gray,
   indistinguishable from the panel. A pocket should be **darker than
   the panel**, with sharply defined edges. Use full black at the top
   edge for the deepest dark; reserve transparency for the bottom
   highlight only.

A fifth issue: the **edge color** of the button itself currently changes
with state (`--btn-border` / `--btn-hover-border` / `--btn-active-border`).
For Volume mode the border is the *niche rim* and must be one fixed
color in all states.

---

## Design Goals

After the change, Volume mode buttons should:

- **G1.** Sit inside a visible, compact, sharp recess that reads as cut
  into the dashboard panel.
- **G2.** Keep the niche identical across **default, hover, focus,
  active, disabled** states. Only the button surface (background, text,
  bevel overlay) reacts to state.
- **G3.** Read correctly in both **dark theme** (deep dark pocket on
  dark panel) and **light theme** (subtle dark pocket on light panel,
  with a visible white reflection on the lower lip).
- **G4.** Use the same niche treatment uniformly across **`<push-button>`,
  `<segmented-control>` segments, `<text-field>`, `<check-box>`,
  `<radio-button>`, `<toggle-switch>` track** — every element that has
  a hard rectangular boundary inside the panel.
- **G5.** Not change the size or layout of any control compared to
  Gradient mode.

---

## Architecture: Niche vs. Button (separation of concerns)

The dashboard niche and the button body are conceptually two different
objects:

| Layer       | Owned by                   | Changes with state? | Theme-dependent? |
|-------------|----------------------------|---------------------|------------------|
| **Niche**   | Panel/dashboard            | No (constant)       | Yes (dark vs light) |
| **Button**  | The control itself         | Yes (default/hover/focus/active/disabled) | Yes |
| **Bevel overlay** | Inner surface of button | Yes (mirrors button bg) | Yes |

The split must be reflected in CSS:

- Niche → painted via `box-shadow` on the **`:host`** of the shadow DOM,
  driven by a single `--niche-shadow` token. Never touched by state
  selectors. Never affected by `:host([disabled])` opacity.
- Button body → painted via background, border, `::before` overlay on
  `.btn`. Reacts to all states. Disabled opacity is applied **only here**.

### Required component change in `flat.js`

Move the disabled opacity off `:host` so the niche shadow stays at full
strength when the button is disabled. The cleanest scoped change:

```css
/* before */
:host([disabled]) { opacity: 0.38; pointer-events: none; }

/* after */
:host([disabled]) { pointer-events: none; }
:host([disabled]) .btn { opacity: 0.38; }
```

The same edit must be applied to the disabled rule of every component
whose niche we want to keep visible: push-button, text-field,
segmented-control, check-box, radio-button, toggle-switch. (For
segmented-control, the niche is on the wrapper, not on each segment —
see "Per-component niche placement" below.)

This is a **shared component change** but only affects appearance in
modes that set a non-`none` niche shadow. In Flat/Gradient/Basic the
niche shadow is `none`, so the visual outcome is identical to before.

---

## Niche Shadow — Recipe

### The "compact deep pocket" formula

A clean recessed pocket is built from **at most three sharp layers** on
a single `box-shadow`, with no diffuse blur:

1. **Top dark line** — the upper edge of the niche where light is
   blocked. Must be the **darkest** value (full black, ~0.9 alpha).
   Sharp: blur 0, vertical offset 1 px, no spread.
2. **Bottom light line** — the lower lip of the niche catches light.
   Sharp: blur 0, vertical offset 1 px, no spread.
   - Dark theme: very subtle white (~6 % alpha).
   - Light theme: stronger white (~70–90 % alpha) — this is the key
     "depression on light surface" cue.
3. **Compact dark depth** — a tiny additional shadow with blur ≤ 2 px
   that sits *just below* the button to ground it. Spread 0, blur ≤ 2,
   alpha ~0.35–0.5. No further halo.

Layers 1 + 2 give the rim. Layer 3 gives the volume. Combined width is
≈ 2 px total — reads as a hairline pocket, not a glow.

### Token plan in `volume.css`

```css
/* Dark theme defaults (under :root) */
--niche-rim-dark:    rgba(0, 0, 0, 0.85);     /* top edge */
--niche-rim-light:   rgba(255, 255, 255, 0.06); /* bottom lip */
--niche-depth:       rgba(0, 0, 0, 0.45);     /* under-shadow */

--niche-shadow:
  inset 0  1px 0 var(--niche-rim-dark),       /* top edge: drawn inset on the niche */
  inset 0 -1px 0 var(--niche-rim-light),      /* bottom lip */
  0 1px 2px var(--niche-depth);               /* depth under the button */

/* Light theme overrides under [data-theme="light"] */
--niche-rim-dark:    rgba(0, 0, 0, 0.30);     /* softer dark line on light surface */
--niche-rim-light:   rgba(255, 255, 255, 0.85); /* bright reflection on lower lip */
--niche-depth:       rgba(0, 0, 0, 0.12);     /* very soft depth */
```

The niche is rendered via `box-shadow` on `:host`. The two `inset`
shadows of the host paint **outside the visible button** — they appear
at the rim where `:host`'s padding-box edge meets the panel. The third,
non-inset shadow is a 2-px drop directly underneath.

> The user's earlier wish "shadow surrounds from all sides, not only
> below" is satisfied by the **top dark / bottom light rim** lines —
> they together describe the full hole — without the spreading blur
> that previously caused the muddy halo. Optional: add symmetric
> left/right inset hairlines (`inset ±1px 0 0 …`) if the rim still
> looks open on the sides during review.

### Where the existing `--shadow-btn` / `--shadow-seg` tokens go

In Gradient mode they are `none`. In the new Volume mode:

```css
--shadow-btn:   var(--niche-shadow);
--shadow-field: var(--niche-shadow);
--shadow-check: var(--niche-shadow);
--shadow-radio: var(--niche-shadow);
--shadow-toggle: var(--niche-shadow);
--shadow-seg:   var(--niche-shadow);
```

All components share one niche profile. Adjustments per component
(e.g. softer rim for tiny checkbox) can be added later only if needed.

---

## Bevel (button body) — adjustments

The bevel mechanism (extended-gradient body + normal-gradient overlay
via `::before`) stays. Two refinements:

### Border becomes the fixed niche rim color

In Volume mode the 1 px border of `.btn`/`.seg` represents the **bottom
of the niche**, which is the same physical surface as the button surround.
It must be one fixed color across all states.

```css
push-button {
  --btn-border:        var(--neutral-5);
  --btn-hover-border:  var(--neutral-5);   /* same */
  --btn-active-border: var(--neutral-5);   /* same */
  /* … */
}
```

(Same idea for `<segmented-control>` segments.)

### Lighter bevels (point (a) of user request)

The "extended gradient" used for the button body provides the bevel.
Validate that:

- `--grad-raised-ext` (dark theme) goes from `neutral-5` (top) →
  `neutral-3` (bottom). The 3-px overlay shows `--grad-raised`
  (`neutral-4` → `neutral-2`). Visible bevel = neutral-5/4 difference
  at top, neutral-3/2 at bottom. This is already in `volume.css`.
- For the lighter bevel feel: do **not** weaken the difference further,
  but ensure the overlay starts at `var(--btn-bevel-width, 3px)` inset.
  Current value 3 px is appropriate. Re-verify after niche change —
  the niche rim line should not visually merge with the bevel.

### Per-state behaviour summary

| State       | Niche shadow | Border | Body background      | Overlay background     | Foreground |
|-------------|--------------|--------|----------------------|------------------------|------------|
| default     | unchanged    | `neutral-5` | `--grad-raised-ext`     | `--grad-raised`     | `--fg`  |
| hover       | unchanged    | `neutral-5` | `--grad-raised-hover-ext` | `--grad-raised-hover` | `--fg`  |
| focus       | unchanged    | `neutral-5` | (no change to body)     | (no change)         | `--fg`  + focus ring outline |
| active/pressed | unchanged | `neutral-5` | `--grad-accent-ext` (or `-sec`) | `--grad-accent` (or `-sec`) | `--bg`  |
| disabled    | unchanged    | `neutral-5` | (default body)        | (default overlay)    | (default fg, then opacity 0.38 on `.btn`) |

### Focus ring

Volume currently has no focus ring distinct from the bevel. Add an
**outer** focus outline that does not interfere with the niche:

```css
.btn:focus-visible {
  outline: 2px solid var(--primary-accent-3);
  outline-offset: 2px;
}
```

Add this rule only inside the Volume-mode component template — not in
Flat/Gradient (they handle focus differently). Implementation: read
`--btn-focus-ring` token, default to `none`. Set in `volume.css`.

---

## Per-component Niche Placement

The niche is applied per-component. The mapping below ensures that we
draw a single coherent pocket per visible element, not per sub-part.

| Component             | Niche on…                            | Notes |
|-----------------------|--------------------------------------|-------|
| `<push-button>`       | `:host`                              | Each button is its own pocket. |
| `<text-field>`        | the `input` (or its wrapper)         | A field already reads as inset; reinforce the rim. |
| `<check-box>`         | `:host`                              | The box itself sits in a niche. |
| `<radio-button>`      | `:host`                              | The circle sits in a niche; rim follows the radius. |
| `<toggle-switch>`     | the `.track` (not the thumb)         | Track is the pocket; thumb is a raised cap inside. |
| `<segmented-control>` | the **wrapper** (`:host` or `.grid`) | One pocket for the whole control; segments inside. |
| `<range-slider>`      | the `.track`                         | Track is the pocket; thumb stays as-is for now. |

Out of scope for this iteration: rotary knob, gauges, calendar,
progress bar (skip until visual review confirms the new niche style).

---

## Theme-Specific Tuning

### Dark theme

- Panel: very dark (`neutral-2`, near black).
- Niche rim top: `rgba(0,0,0,0.85)` — pure black wins because the panel
  is not pure black; even a 15 % difference reads as a sharp rim.
- Niche rim bottom: `rgba(255,255,255,0.06)` — barely there, just enough
  to suggest the lower curvature catching the dim ambient light.
- Niche depth: `rgba(0,0,0,0.45)` — sits below the button as a
  micro-shadow that lifts the body ~1 px above the rim.

### Light theme

- Panel: light gray (`neutral-2` reversed, near white).
- Niche rim top: `rgba(0,0,0,0.30)` — never use full black on light
  panels; it reads as a printed line, not a recess.
- Niche rim bottom: `rgba(255,255,255,0.85)` — strong white reflection
  is the **primary cue** that this is a hole on a light surface.
  Without this line, the niche disappears.
- Niche depth: `rgba(0,0,0,0.12)` — a very soft drop. Light surfaces
  tolerate almost no dark blur before looking dirty.

---

## Edge Cases & Sensitive Details

1. **Square icon-only buttons.** The button now uses `width: 1em` SVG
   icons, so its height matches text buttons. Niche box-shadow on
   `:host` therefore renders the same height. ✓
2. **Pressed icon button (`pressed` attr).** Niche stays neutral
   (rim color unchanged). Only body switches to `--grad-accent-ext`.
   The accent gradient is bordered by the neutral rim, so the pocket
   still reads as part of the dashboard, not the button.
3. **Disabled button.** Niche stays full strength. Body opacity 0.38
   only on `.btn`. Test: disabled rectangular button next to active
   button — both pockets must look identical.
4. **Hover transition.** `transition: background 0.12s` on `.btn`
   stays. Do not transition the niche shadow — it should never animate.
5. **Border-radius alignment.** The niche `box-shadow` uses
   `border-radius` from `:host`. Set
   `:host { border-radius: var(--btn-radius, 6px); }` in the component
   template so the rim follows the button corners.
6. **Segmented control corners.** Segments have per-corner radii via
   inline style. The niche on the wrapper uses the **outer** radius
   only; individual segment dividers are a separate concern (kept as-is
   from gradient.css).
7. **High-DPI rendering.** 1 px sharp shadow lines render crisply on
   retina; do not use sub-pixel offsets (e.g. `0.5px`).

---

## Files to Touch

| File | Change |
|------|--------|
| `public/js/controls/flat.js` | Move disabled opacity from `:host` to inner element. Add `:host { border-radius: var(--btn-radius); }` so niche follows corners. Add focus-visible rule gated on `--btn-focus-ring`. Repeat for text-field, check-box, radio-button, toggle-switch (track), segmented-control (wrapper). |
| `public/css/styles/volume.css` | Add `--niche-rim-dark`, `--niche-rim-light`, `--niche-depth`, `--niche-shadow` tokens at `:root`. Add light-theme overrides at `[data-theme="light"]`. Set all `--shadow-*` tokens to `var(--niche-shadow)`. Set per-component borders to fixed `var(--neutral-5)` in default/hover/active. Set `--btn-focus-ring` to a primary-accent outline. |
| `public/css/styles/gradient.css` | **No changes.** |
| `public/css/styles/flat.css` | **No changes.** |
| `public/css/styles/basic.css` | **No changes.** |

The `flat.js` edits are technically shared, but they are no-ops in
modes where `--shadow-*` is `none` and `--btn-focus-ring` is `none`.
Verify this by switching modes after the edit.

---

## Verification Checklist

After implementation, in the browser:

- [ ] **Dark + Volume.** Default/hover/active/disabled push buttons all
  show the same compact dark pocket around them. The pocket has a
  visible top-dark line and a barely visible bottom-light line.
- [ ] **Light + Volume.** Same pockets visible, with a clearly
  brighter bottom reflection. No black halo.
- [ ] **Disabled.** Niche brightness identical to enabled neighbours.
  Only button text/icon/body fade.
- [ ] **Switch to Gradient mode.** No niche; appearance identical to
  before this change.
- [ ] **Switch to Flat mode.** No niche; identical to before.
- [ ] **Segmented control.** One pocket around the whole control.
  Selected segment uses accent body inside the pocket.
- [ ] **Toggle switch.** Pocket on the track only; thumb remains
  raised.
- [ ] **Text field, checkbox, radio.** Pocket consistent with buttons.

---

## Out of Scope

- Rotary knobs, gauges, calendar, progress bar — revisit after the
  basic niche is approved.
- Animations on niche (none planned; niche is a static dashboard
  property).
- Outer drop shadow on raised thumbs/knobs — keep current values from
  Gradient mode unless review demands otherwise.

---

## References (research used to design this plan)

- *Make your button look like an actual button* — Nikolai Lehbrink.
  Demonstrates the inner-highlight + outer-drop layered button. Used
  for the bevel/overlay refinement.
- *CSS Inset Box Shadow: Complete Guide with Examples* — WildAndFree.
  Section "Combining Inset and Outer Shadows" — the comma-separated
  inset+outer pattern is the basis of `--niche-shadow`.
- *Neumorphism and CSS* — CSS-Tricks. Confirms the "two opposite
  shadows = volume" principle, but adapted here to **single-direction
  inset rim** because we want a *deep pocket*, not a soft floating
  cushion.
- *How to Create Simple Skeuomorphic Buttons in CSS* — Jon Kantner,
  DEV Community. Source for the "edges of the button hole" idea
  (separate dark top-edge + light bottom-edge of the hole).
