# Custom HTML Controls — Implementation Plan

## Colour Palette

| Token        | Hex       | Description                                      |
|--------------|-----------|--------------------------------------------------|
| `--bg`       | `#0f1210` | Very dark, faint greenish background             |
| `--fg`       | `#e8ede9` | Very light, faint greenish foreground            |
| `--neutral-1`| `#2a2f2b` | Darker neutral (greenish-grey)                   |
| `--neutral-2`| `#6b7370` | Lighter neutral (greenish-grey)                  |
| `--accent-1` | `#ee7f09` | Darker gold, slightly reddish                    |
| `--accent-2` | `#ffce1b` | Lighter gold, slightly yellowish                 |

All colours are defined once as CSS custom properties in a shared `tokens.css` and re-exported as JS constants in `tokens.js` so every control can reference them.

---

## Project Structure (target)

```
htmlcontrols/
├── PLAN.md
├── index.html                  ← demo / playground page
├── css/
│   └── tokens.css              ← CSS custom properties (palette, spacing)
├── js/
│   ├── tokens.js               ← palette as JS constants (for canvas/SVG)
│   └── controls/
│       ├── rotary-knob.js      ← <rotary-knob> Web Component
│       ├── push-button.js      ← <push-button>
│       ├── segmented-control.js← <segmented-control>
│       ├── toggle-switch.js    ← <toggle-switch>
│       ├── slider.js           ← <range-slider>
│       ├── progress-bar.js     ← <progress-bar>
│       ├── range-selector.js   ← <range-selector>
│       ├── radio-button.js     ← <radio-button>
│       ├── check-box.js        ← <check-box>
│       ├── text-field.js       ← <text-field>
│       ├── dropdown-menu.js    ← <dropdown-menu>
│       └── dropdown-calendar.js← <dropdown-calendar>
└── assets/                     ← optional static assets
```

Every control is a **self-contained Web Component** (Custom Element + Shadow DOM) so it can be dropped into any project with a single `<script>` import and a custom tag.

---

## Phase 1 — Rotary Knob

- [x] **Step 1: Scaffold & Palette**
  - Create `css/tokens.css` with all palette variables.
  - Create `js/tokens.js` exporting the same values as JS hex strings.
  - Create bare `index.html` importing both files, with a dark `--bg` body.

- [x] **Step 2: Rotary Knob — Static Rendering (Canvas)**
  - Create `js/controls/rotary-knob.js` defining `<rotary-knob>` custom element.
  - Use an internal `<canvas>` for all drawing (sharp rendering at any DPI).
  - Implement drawing helpers:
    - **Outer circle**: linear gradient `neutral-1 → neutral-2`, direction hardcoded as a constant (`GRAD_ANGLE_DEG`) at the top of the file for easy manual tweaking.
    - **Inner circle**: same gradient colours, opposite direction (`GRAD_ANGLE_DEG + 180`).
  - Both circles are always stationary — only the pointer moves.

- [x] **Step 3: Pointer (Indicator Segment)**
  - Draw a short rounded-cap line segment near the inner-circle edge.
  - Gradient along the radial direction: `accent-1` (near centre) → `accent-2` (near edge).
  - Angular position `θ` derived from the current value.

- [x] **Step 4: Value Indicators — Continuous Mode**
  - Attribute: `mode="continuous"` (default), `min`, `max`, `value`, `step` (optional).
  - Draw a thick arc in `neutral-2` just outside the outer circle, with a gap at the 12-o'clock (top) position where start meets end.
  - Overlay an accent-coloured arc from start to current-value angle:
    - Start colour = `accent-2`.
    - End colour = `lerp(accent-1, accent-2, alpha)` where `alpha = (value - min) / (max - min)`.
  - Clockwise direction; 0 (start) is at top.

- [x] **Step 5: Value Indicators — Enumerated Mode**
  - Attribute: `mode="enum"`, `values` (JSON array or comma-separated).
  - Place text labels evenly around the outer circle, clockwise from top.
  - Trim each label to max 3 characters.
  - All choices in `accent-1` (normal font); currently selected in `accent-2` (bold font).

- [x] **Step 6: Title & Value Caption**
  - Below the knob, centred: `Title :  value` — title in `--fg`, colon in `--fg`, value in `accent-2`.
  - Full combined text is measured first, then horizontally centred as a unit.

- [x] **Step 7: Interaction — Mouse**
  - **Single click** anywhere on the knob area → compute angle from centre → snap/set value.
  - **Click-and-hold + drag** → continuously update angle as mouse moves.
    - Continuous mode: smooth value tracking.
    - Enum mode: snap to the nearest enum position.
  - Lightweight eased animation (`requestAnimationFrame` + ease-out) for all pointer transitions.

- [x] **Step 8: Public API & Events**
  - Properties / attributes: `value`, `min`, `max`, `step`, `mode`, `values`, `label`.
  - Fires `input` event on every visual change and `change` on release.
  - Methods: `setValue(v)`, `getValue()`.

- [x] **Step 9: Demo Page**
  - `index.html` with two knobs side-by-side:
    1. Continuous: range 0–100.
    2. Enum: days of the week.
  - Dark background, centred layout.

- [ ] **Step 10: Rotary Knob — Disabled State**
  - When `disabled` attribute is set, draw with reduced opacity, ignore pointer events.

---

## Phase 2 — Button & Segmented Control

- [ ] **Step 11: Push Button — Design**
  - `<push-button>` Web Component.
  - Rounded-corner rectangle with inner/outer rects sharing same gradient in opposite directions (like rotary knob circles).
  - Outer rect only slightly larger than inner — size increase % hardcoded as a constant.
  - Corner radius in `%` (hardcoded constant); gradient angle hardcoded constant.
  - Pseudo-3D convex resting state; concave pressed state (inverted gradient + slight inset).
  - Label text in `--fg`.

- [ ] **Step 12: Push Button — Interaction**
  - `mousedown` → pressed visual; `mouseup` / `mouseleave` → release visual.
  - Fires `activate` event. Smooth CSS transitions between states.
  - Demo: Play/Pause toggle button with alternating "▶ Play" / "⏸ Pause" text.

- [ ] **Step 13: Segmented Control — Design**
  - `<segmented-control>` Web Component.
  - Grid of rounded-corner segments sharing the same outer/inner gradient technique.
  - Supports `columns` attribute for multi-column layout (e.g. 4 cols × 2 rows).
  - Selected segment uses accent gradient; others use neutral gradient.

- [ ] **Step 14: Segmented Control — Interaction**
  - Click a segment to select it; fires `change` event with `detail.value`.
  - Smooth transition on selection change.
  - Demo: language selection ("EN", "ES", "FR", "DE", "RU", "KO", "JP", "CN") in 2 rows × 4 cols.

- [ ] **Step 15: Button & Segmented Control — Disabled State**
  - When `disabled` attribute is set, reduced opacity, no pointer events.

- [ ] **Step 16: Phase 2 — Demo & Integration**
  - Add button and segmented control examples to `index.html`.
  - Rearrange page layout so all controls fit without scrolling.

---

## Phase 3 — Toggle Switch

- [ ] **Step 17: Toggle Switch — Design**
  - `<toggle-switch>` Web Component.
  - Track rendered as a rounded capsule with subtle inset shadow (pseudo-3D groove).
  - Thumb (slider circle) with same gradient technique as the rotary knob circles.
  - Off state: `neutral-1`/`neutral-2` palette; On state: accent glow/gradient.

- [ ] **Step 18: Toggle Switch — Interaction**
  - Click toggles state.
  - Smooth animated thumb slide + colour crossfade.
  - Fires `change` event with `detail.checked`.

- [ ] **Step 19: Toggle Switch — Disabled State**
  - When `disabled`, reduced opacity, no pointer events.

- [ ] **Step 20: Phase 3 — Demo & Integration**
  - Add toggle switch examples to `index.html`.

---

## Phase 4 — Slider, Progress Bar, Range Selector

- [ ] **Step 21: Slider (`<range-slider>`)**
  - Horizontal track (inset groove) + draggable thumb (pseudo-3D circle).
  - Accent fill from left to thumb position.
  - Attributes: `min`, `max`, `value`, `step`, `label`.

- [ ] **Step 22: Progress Bar (`<progress-bar>`)**
  - Non-interactive horizontal bar.
  - Accent-gradient fill proportional to `value` / `max`.
  - Attributes: `value`, `max`, `label`.

- [ ] **Step 23: Range Selector (`<range-selector>`)**
  - Two draggable thumbs defining a sub-range.
  - Accent fill between the two thumbs.
  - Attributes: `min`, `max`, `low`, `high`, `step`, `label`.

- [ ] **Step 24: Phase 4 — Disabled States & Demo**
  - Disabled variants for all three. Add examples to `index.html`.

---

## Phase 5 — Radio Button & Checkbox

- [ ] **Step 25: Radio Button (`<radio-button>`)**
  - Circular pseudo-3D outer ring; accent-filled inner dot when selected.
  - Group via shared `name` attribute.

- [ ] **Step 26: Checkbox (`<check-box>`)**
  - Rounded-square pseudo-3D box; accent checkmark when checked.

- [ ] **Step 27: Phase 5 — Disabled States & Demo**
  - Disabled variants. Add examples to `index.html`.

---

## Phase 6 — Text Field, Dropdown Menu, Dropdown Calendar

- [ ] **Step 28: Text Field (`<text-field>`)**
  - Inset pseudo-3D input area. Focus ring in accent colour.
  - Attributes: `placeholder`, `value`, `label`.

- [ ] **Step 29: Dropdown Menu (`<dropdown-menu>`)**
  - Collapsed: looks like a push button with a chevron.
  - Expanded: floating list with pseudo-3D panel. Accent highlight on hover/selection.
  - Attributes: `values`, `value`, `label`.

- [ ] **Step 30: Dropdown Calendar (`<dropdown-calendar>`)**
  - Single-date and date-range modes.
  - Collapsed: date display field. Expanded: month grid with pseudo-3D panel.
  - Accent highlight on selected date(s); range highlight between start/end.
  - Attributes: `mode` ("single" | "range"), `value`, `label`.

- [ ] **Step 31: Phase 6 — Disabled States & Demo**
  - Disabled variants. Add examples to `index.html`.

---

## Global

- [ ] **Disabled-mode toggle**
  - Simple flat checkbox (theme-coloured, not 3D, not accent) in the bottom-right corner of the page.
  - When checked, sets `disabled` attribute on every control on the page.
  - When unchecked, removes `disabled` from all controls.

---

## Implementation Notes

- **No build step required** — all files are plain ES modules; open `index.html` directly in a browser (or via a trivial local server if module CORS requires it).
- **Gradient direction constant** — in each control file, look for:
  ```js
  const GRAD_ANGLE_DEG = 135; // ← tweak this to change gradient direction
  ```
- **Modular reuse** — to use a control in another project, copy its JS file + `tokens.css`/`tokens.js`, add `<script type="module">` and the custom tag.
