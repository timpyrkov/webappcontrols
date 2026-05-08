# Custom HTML Controls — Implementation Plan

## Architecture Overview

This project is a **showcase + export tool** for reusable Web UI components.
Users select a visual style (Flat, Grooves, Shadows, etc.), customise the palette,
and export a self-contained module ZIP that can be integrated into any web project.

---

## Colour System

| Layer | Source | Purpose |
|-------|--------|---------|
| `palette_tools.js` + `palettes.js` | Palette engine | Generates 4 variants (dark/light × tinted/accented) from seed colours |
| `tokens.css` | CSS fallbacks | Default amber darkTinted values; overwritten at runtime |
| `tokens.js` | JS fallbacks | Same values as JS constants; re-read on palette change |
| `app.js` | Runtime | Calls `createPalette()`, sets CSS variables on `:root` |

### Token conventions

| Role | CSS variable | Neutral index |
|------|-------------|---------------|
| Page background | `--bg` | neutral-1 |
| Panel background | `--panel-bg` | neutral-2 |
| Button/surface background | `--neutral-3` | neutral-3 |
| Borders, edges | `--neutral-5` | neutral-5 |
| Muted text, labels | `--neutral-7` | neutral-7 |
| Primary foreground | `--fg` | neutral-12 |
| Accents (lighter → darker) | `--primary-accent-1..5` | — |

---

## Multi-Style Architecture

### Approach: Per-style JS modules with shared base classes

Each visual style (Flat, Grooves, Shadows) gets its own **control bundle** that defines
all Web Components with style-specific rendering. Shared logic (attributes, events,
interaction) lives in base classes.

```
public/js/controls/
├── base/                         ← Shared: attributes, events, interaction, layout
│   ├── push-button-base.js
│   ├── text-field-base.js
│   ├── check-box-base.js
│   ├── radio-button-base.js
│   ├── toggle-switch-base.js
│   ├── segmented-control-base.js
│   ├── slider-base.js
│   ├── progress-bar-base.js
│   ├── dropdown-menu-base.js
│   ├── dropdown-calendar-base.js
│   ├── notification-bar-base.js
│   ├── rotary-knob-base.js
│   └── gauges-base.js
├── flat.js                       ← Imports bases, adds flat rendering (current)
├── grooves.js                    ← Imports bases, adds groove/inset rendering
├── shadows.js                    ← Imports bases, adds shadow/bevel rendering
├── gradient.js                   ← Imports bases, adds gradient rendering
├── basic.js                      ← Imports bases, minimal styling
└── volume.js                     ← Imports bases, adds volumetric 3D rendering
```

### How it works

1. **Base classes** contain:
   - `observedAttributes`, `attributeChangedCallback`
   - Event dispatching (`input`, `change`, `activate`)
   - Pointer/keyboard interaction logic
   - Value management (min/max/step clamping, enum indexing)
   - Animation helpers

2. **Style modules** (`flat.js`, `grooves.js`, etc.) contain:
   - Class extensions that override `_render()` (DOM controls) or `_draw()` (canvas controls)
   - Style-specific CSS-in-JS templates
   - `customElements.define()` calls
   - Style-specific drawing parameters (gradient angles, shadow depths, bevel strengths)

3. **Style switching** in the showcase:
   - `style-manager.js` dynamically imports the selected style module
   - CSS file swap for layout-level overrides (`css/styles/<style>.css`)
   - Canvas controls re-render with new drawing logic

4. **Style CSS files** (`css/styles/flat.css`, etc.) only contain:
   - Component-level CSS custom property overrides (sizes, radii, padding)
   - No complex shadows/gradients — those are in JS rendering

### Why this approach

| Requirement | How it's met |
|-------------|-------------|
| Groove/shadow effects need different DOM structure | Per-style `_render()` |
| Canvas controls need different drawing | Per-style `_draw()` |
| Export must contain only one style | Ship one JS file + one CSS file |
| Bug fixes propagate automatically | Shared base classes |
| No wasted code in export | No branching, no unused style logic |
| No runtime performance cost | No if/else per frame |

---

## Style Descriptions

### Flat (implemented ✓)
- Solid colour fills, no gradients
- Subtle 1px borders in neutral-5
- Active/selected states: solid accent fill
- Slider thumbs: solid accent circle with box-shadow

### Grooves (to implement)
- Inset groove tracks: `box-shadow: inset 0 2px 4px` on dark sides
- Convex knobs/thumbs: multi-stop linear gradient (light-top, dark-bottom)
- Active states: accent glow (`box-shadow: 0 0 8px accent`)
- Canvas controls: gradient strokes simulating recessed channels

### Shadows (to implement)
- Raised surfaces: outer shadow + subtle inner highlight
- Bevel effect on buttons/segments: top-light, bottom-dark border tones
- Active states: inset (pressed) shadow, accent accent hue
- Canvas controls: drawn highlights/shadows on knob body and gauge rims

### Gradient (to implement)
- Smooth gradient fills on surfaces (dark-to-mid neutral)
- Accent gradient on active elements (accent-1 → accent-5)
- Soft edge glow on focus

### Volume (to implement)
- Full pseudo-3D: strong convex gradients, deep inset tracks
- Pronounced highlight/shadow pairs
- "Physical" button press animation with depth change

### Basic (to implement)
- Minimal browser-like defaults
- Thin borders, no shadows, no gradients
- Small radii, compact padding

---

## Project Structure

```
webappcontrols/
├── PLAN.md                           ← This file
├── STYLE.md                          ← Generated: style description for export
├── PROMPT.md                         ← Generated: integration instructions for export
├── public/
│   ├── index.html                    ← Showcase page
│   ├── css/
│   │   ├── tokens.css                ← Default palette tokens (amber darkTinted)
│   │   ├── layout.css                ← Page layout for the showcase
│   │   └── styles/
│   │       ├── flat.css              ← Flat style CSS overrides
│   │       ├── grooves.css           ← Grooves style CSS overrides
│   │       ├── shadows.css           ← Shadows style CSS overrides
│   │       ├── gradient.css          ← Gradient style CSS overrides
│   │       ├── volume.css            ← Volume style CSS overrides
│   │       └── basic.css             ← Basic style CSS overrides
│   └── js/
│       ├── app.js                    ← Entry point: palette, style switching, layout
│       ├── tokens.js                 ← Palette tokens as JS constants
│       ├── gen_colors.js             ← Colour utilities (oklch, lerp)
│       ├── palette_tools.js          ← Palette generation engine
│       ├── palettes.js               ← 15 palette definitions + i18n
│       ├── style-manager.js          ← Style switching logic
│       ├── style-export.js           ← NEW: Export ZIP generation
│       └── controls/
│           ├── base/                 ← Shared base classes
│           ├── flat.js               ← Flat style rendering
│           ├── grooves.js            ← Grooves style rendering
│           ├── shadows.js            ← Shadows style rendering
│           ├── gradient.js           ← Gradient style rendering
│           ├── volume.js             ← Volume style rendering
│           └── basic.js              ← Basic style rendering
└── palette-modules/
    ├── palette_tools.js              ← Palette engine (export copy)
    ├── palettes.js                   ← Palette definitions (export copy)
    ├── PROMPT.md                     ← Palette integration instructions
    ├── PALETTES.md                   ← Palette module documentation
    └── palette-*.json                ← Pre-computed palette variants
```

---

## Component List

All styles must implement these components:

| Component | Tag | Type | Notes |
|-----------|-----|------|-------|
| Push Button | `<push-button>` | DOM | Primary/secondary accent variants |
| Text Field | `<text-field>` | DOM | With placeholder, focus ring |
| Checkbox | `<check-box>` | DOM | Accent checkmark |
| Radio Button | `<radio-button>` | DOM | Grouped by `name` |
| Toggle Switch | `<toggle-switch>` | DOM | Animated thumb slide |
| Segmented Control | `<segmented-control>` | DOM | Multi-column grid |
| Slider (H & V) | `<range-slider>` | DOM | Single & range modes |
| Progress Bar | `<progress-bar>` | DOM | Non-interactive |
| Dropdown Menu | `<dropdown-menu>` | DOM | Floating list |
| Dropdown Calendar | `<dropdown-calendar>` | DOM | Single & range date modes |
| Notification Bar | `<notification-bar>` | DOM | 5 severity levels |
| Rotary Knob | `<rotary-knob>` | Canvas | Continuous & enum modes |
| Circular Gauge | `<circular-gauge>` | Canvas | Arc + segments modes |
| Linear Gauge (H) | `<linear-gauge>` | Canvas | Horizontal variant |
| Linear Gauge (V) | `<linear-gauge>` | Canvas | Vertical variant |
| Bar Chart | `<bar-chart>` | Canvas | Category colours |
| Color Picker | `<color-picker>` | DOM | Hue/saturation/lightness |

---

## Implementation Phases

### Phase 1 — Refactor: Extract Base Classes ✦ PRIORITY

- [ ] **Step 1: Extract base classes from current `flat.js`**
  - Move attribute parsing, event dispatch, interaction logic into `base/*.js`
  - Keep rendering in `flat.js` as style-specific overrides
  - Ensure existing showcase works identically after refactor

- [ ] **Step 2: Extract base classes for canvas controls**
  - `rotary-knob-base.js` — value management, animation, pointer handling
  - `gauges-base.js` — value management, animation
  - Style-specific drawing stays in `flat.js` (or new per-style canvas renderers)

- [ ] **Step 3: Refactor `style-manager.js`**
  - Support dynamic import of per-style JS modules
  - On style switch: swap CSS link + re-register/re-render components
  - Expose `getActiveStyle()` and `switchStyle(name)` API

---

### Phase 2 — Grooves Style

- [ ] **Step 4: Grooves — DOM Controls**
  - Create `controls/grooves.js`
  - Button: gradient bevel (light-top → dark-bottom), inset on press
  - Toggle: grooved track (inset shadows), convex thumb
  - Slider: recessed groove track, raised thumb with gradient
  - Checkbox/Radio: inset container, accent fill on check
  - Text field: inset groove border
  - Segmented: grooved dividers between segments

- [ ] **Step 5: Grooves — Canvas Controls**
  - Rotary knob: gradient ring with highlight arc, groove channel
  - Gauges: beveled arc track, 3D segment caps

- [ ] **Step 6: Grooves — Integration & Polish**
  - Wire into style-manager
  - Verify all controls render correctly
  - Test palette switching + theme toggle

---

### Phase 3 — Shadows Style

- [ ] **Step 7: Shadows — DOM Controls**
  - Create `controls/shadows.js`
  - Button: drop shadow + inner highlight, press = shadow flip
  - Toggle: shadow on thumb, glow on active track
  - Slider: shadow under thumb, soft glow on fill
  - Checkbox/Radio: subtle shadow, accent glow on check
  - Text field: inset shadow, outer glow on focus
  - Segmented: shadow on selected segment (raised)

- [ ] **Step 8: Shadows — Canvas Controls**
  - Rotary knob: shadow behind body, highlight crescent
  - Gauges: shadow under hand/pointer, soft glow on active segments

- [ ] **Step 9: Shadows — Integration & Polish**
  - Wire into style-manager
  - Verify + test

---

### Phase 4 — Remaining Styles (Gradient, Volume, Basic)

- [ ] **Step 10: Gradient style** — smooth gradient fills, accent gradient active states
- [ ] **Step 11: Volume style** — full pseudo-3D with strong depth cues
- [ ] **Step 12: Basic style** — minimal, browser-default-like rendering

---

### Phase 5 — Style Export Feature

- [ ] **Step 13: Create `style-export.js` module**
  - Function: `exportStyleZip(styleName)` → triggers browser download of ZIP
  - Uses JSZip library (or inline ZIP builder) for client-side ZIP creation

- [ ] **Step 14: ZIP contents assembly**
  The export produces `style-modules.zip` containing:
  ```
  style-modules/
  ├── PROMPT.md              ← AI/human integration instructions (generated)
  ├── STYLE.md               ← Style features & API reference (generated)
  ├── js/
  │   ├── tokens.js          ← Palette token reader
  │   ├── gen_colors.js      ← Colour utilities
  │   ├── palette_tools.js   ← Palette generation engine
  │   ├── palettes.js        ← All 15 palette definitions + i18n
  │   └── controls/
  │       ├── base/           ← All shared base classes
  │       └── style.js        ← The ONE selected style (renamed from flat.js/grooves.js/etc.)
  ├── css/
  │   ├── tokens.css          ← Default palette tokens
  │   └── style.css           ← The ONE selected style CSS (normalised name)
  └── example.html            ← Minimal working demo with all controls
  ```

- [ ] **Step 15: PROMPT.md generation**
  Dynamically generated based on active style. Structure:
  ```
  1. Review existing codebase (framework, CSS patterns, layout)
  2. Copy exported files to project
  3. Add <link> for style.css + tokens.css
  4. Add <script type="module"> for controls
  5. Replace existing UI elements with custom elements
  6. Wire palette engine (palette selector, theme toggle)
  7. Replace existing colour rules with token CSS variables
  8. Notes on replacing previously existing elements/layout rules
  ```

- [ ] **Step 16: STYLE.md generation**
  Dynamically generated based on active style. Structure:
  ```
  1. Style overview (visual identity, design principles)
  2. Files included (table with roles)
  3. Component API reference (per-component: attributes, events, CSS properties)
  4. Token usage convention (which neutrals for which purpose)
  5. Customisation guide (how to tweak sizes, radii, colours)
  6. Canvas control parameters (drawing constants)
  ```

- [ ] **Step 17: "Export Style" button in UI**
  - Add button to the left-hand sidebar (below style selector)
  - On click: calls `exportStyleZip(getActiveStyle())`
  - Shows brief feedback ("Downloading style-modules.zip…")

---

### Phase 6 — Disabled States (all styles)

- [ ] **Step 18: Implement disabled state for all components**
  - `opacity: 0.38; pointer-events: none` (DOM)
  - Reduced opacity drawing (canvas)
  - Global disable toggle in showcase UI

---

## Export Design Details

### PROMPT.md template (for export)

The generated PROMPT.md follows the format of `palette-modules/PROMPT.md`:
- Step-by-step integration plan
- Readable by both human developers and AI Code Assistants
- Includes notes on replacing previously existing elements and layout rules
- References specific file names and API from the export

### STYLE.md template (for export)

The generated STYLE.md follows the format of `palette-modules/PALETTES.md`:
- Full API documentation for all exported components
- Design philosophy of the specific style
- Token usage rules
- Customisation parameters

### Normalised naming in export

- Style JS: always `controls/style.js` (regardless of source style name)
- Style CSS: always `css/style.css`
- Style name documented inside STYLE.md header

---

## Implementation Notes

- **No build step** — all files are plain ES modules served via dev server (port 3000)
- **Custom Elements** — each control is self-contained via Shadow DOM
- **Canvas controls** — use `tokens.js` COLORS for drawing, re-render on `palette-changed` event
- **Style switching** — dynamic import + CSS link swap (no page reload)
- **Export** — client-side ZIP generation, no server dependency
- **Palette engine** — always included in export for full palette switching support
