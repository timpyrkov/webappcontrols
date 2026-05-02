# Web App Controls — Layout & Architecture Redesign Plan

> **Goal**: Redesign the project as a reusable, publicly deployable GitHub project with
> Vercel-compatible authentication, a two-panel layout, theme/style/language/palette
> switching, and a comprehensive showcase of all major web UI controls.

---

## 1. Project Structure

```
webappcontrols/
├── .env                              ← LOGIN_USER=demo  LOGIN_PASS=demo
├── .gitignore
├── package.json                      ← dev server script, dependencies
├── server.js                         ← Local Express dev server with session auth
├── vercel.json                       ← Vercel routing & serverless config
├── LAYOUT.md                         ← This file
├── PLAN.md                           ← Legacy implementation plan (kept for reference)
├── README.md
│
├── api/                              ← Vercel serverless functions
│   └── login.js                      ← POST /api/login — validates creds, sets cookie
│
├── public/                           ← Static assets root (served by Express & Vercel)
│   ├── login.html                    ← Login page (username + password form)
│   ├── index.html                    ← Main two-panel app shell
│   │
│   ├── css/
│   │   ├── layout.css                ← Two-panel grid, scrolling, responsive rules
│   │   ├── tokens.css                ← CSS custom properties (generated from palette)
│   │   ├── login.css                 ← Login page styles
│   │   └── styles/                   ← One file per visual style
│   │       ├── basic.css             ← No tuning — browser defaults + token colours
│   │       ├── flat.css              ← Fills and edges adapted to theme, no gradients
│   │       ├── gradient.css          ← Simple linear-gradient fills
│   │       ├── volume.css            ← Inner/outer gradients for pseudo-3D volume
│   │       ├── grooves.css           ← Volume + elements sunk in dashboard slots
│   │       └── shadows.css           ← Grooves + cast shadows, richer gradients
│   │
│   ├── js/
│   │   ├── app.js                    ← Boot, wire global controls ↔ preview panel
│   │   ├── auth.js                   ← Client-side: check cookie, redirect to login
│   │   ├── gen_colors.js             ← OKLCh palette generator (3 seeds → full palette)
│   │   ├── tokens.js                 ← Palette as JS constants (legacy compat)
│   │   │
│   │   ├── i18n/                     ← One JSON per language
│   │   │   ├── en.json
│   │   │   ├── es.json
│   │   │   ├── fr.json               ← placeholder / disabled
│   │   │   ├── de.json               ← placeholder / disabled
│   │   │   ├── ru.json               ← placeholder / disabled
│   │   │   ├── ko.json               ← placeholder / disabled
│   │   │   ├── jp.json               ← placeholder / disabled
│   │   │   └── cn.json               ← placeholder / disabled
│   │   │
│   │   ├── palettes.js               ← Palette seeds: name + accents[] per palette
│   │   ├── i18n.js                   ← i18n loader: loadLanguage(), t() helper
│   │   ├── style-manager.js          ← Loads/unloads style CSS+JS, exposes applyStyle()
│   │   │
│   │   └── controls/                 ← One JS file per style level (all elements inside)
│   │       ├── basic.js              ← All Web Components in Basic style
│   │       ├── flat.js               ← All Web Components in Flat style
│   │       ├── gradient.js           ← All Web Components in Gradient style
│   │       ├── volume.js             ← All Web Components in Volume style
│   │       ├── grooves.js            ← All Web Components in Grooves style
│   │       └── shadows.js            ← All Web Components in Shadows style
│   │
│   └── assets/
│       └── fonts/
│           ├── DSEG7Classic-Regular.woff2    ← 7-Segment font
│           └── Orbitron-VariableFont.woff2   ← Orbitron font
```

### Key Principles

- **No build step** — plain ES modules, served statically.
- **One style bundle = one JS file + one CSS file** — copy a single pair to another project.
- **Each style CSS file must define the same set of class/variable names** so switching
  is seamless — a shared checklist (see §5) guarantees consistency.
- **i18n JSON files** provide caption text for every labelled element; switching language
  triggers a DOM-text update pass.

### 1.1 Controls Architecture — Per-Style Bundles

Instead of one JS file per control element (e.g. `push-button.js`, `toggle-switch.js`),
each **style level** gets a single JS file that defines **all** Web Components for that
style. This is the key enabler for reuse:

```
To add styled controls to another project, copy exactly:
  1. js/controls/<style>.js       ← e.g. flat.js  (all Web Components)
  2. css/styles/<style>.css        ← e.g. flat.css (all CSS for that style)
  3. js/gen_colors.js              ← palette generator (optional, for dynamic theming)
  4. js/palettes.js                ← palette seeds  (optional, for dynamic theming)
  5. js/i18n.js + i18n/*.json      ← i18n support   (optional, for multi-language)
  6. assets/fonts/*                ← custom fonts   (optional)
```

**Why per-style files instead of per-element?**

- A lightweight test project picks `basic.js` — minimal, no gradients, smallest code.
- A consumer-grade app picks `shadows.js` — full pseudo-3D, cast shadows, rich gradients.
- You never carry unused style variants. One `<script>` import, one `<link>`, done.

**Internal structure of each style JS file:**

Each file (e.g. `volume.js`) registers every Web Component custom element with its
rendering logic already baked in for that visual style. Simplified skeleton:

```js
// js/controls/volume.js

// ── Shared helpers (palette, i18n, font) ────────────────────────
import { t, onLanguageChanged } from '../i18n.js';

const STYLE = 'volume';

function getToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── <push-button> ───────────────────────────────────────────────
class PushButton extends HTMLElement {
  // ... Volume-style rendering (inner/outer gradients, pseudo-3D) ...
  // ... Reads --primary-accent-*, --neutral-* from CSS vars ...
  // ... Listens for 'language-changed' to update label via t(key) ...
}
customElements.define('push-button', PushButton);

// ── <toggle-switch> ─────────────────────────────────────────────
class ToggleSwitch extends HTMLElement { /* ... */ }
customElements.define('toggle-switch', ToggleSwitch);

// ── <rotary-knob> ───────────────────────────────────────────────
class RotaryKnob extends HTMLElement { /* ... canvas-based ... */ }
customElements.define('rotary-knob', RotaryKnob);

// ... all other elements ...
```

**Style switching in this showcase app** is handled by `style-manager.js`, which:
1. Unregisters the current style's `<script>` (removes elements, re-creates them).
2. Loads the new style's JS + CSS pair.
3. Since custom element names are globally registered and cannot be re-defined,
   `style-manager.js` uses a full page reload approach or an iframe-based swap
   when switching between styles. For the showcase app this is acceptable — in a
   real consumer project you pick one style at build time and never switch.

### 1.2 Built-in Theme, Palette, Language & Font Support

Every Web Component in every style bundle has these built-in capabilities:

**Theme & Palette** — Controls read colours from CSS custom properties (`--primary-accent-1`,
`--bg`, etc.) at render time. When `gen_colors.js` regenerates the palette (due to theme
or palette change), it updates `:root` CSS vars, and controls automatically pick up new
values on next repaint. Canvas-based controls listen for a `palette-changed` event on
`document` to trigger an explicit redraw.

**Language (i18n)** — Controls that display text accept a `data-i18n` key attribute.
They call `t(key)` from `i18n.js` to resolve the current translation. They also listen
for the `language-changed` event on `document` to re-render when the user switches
language. Fallback chain: requested language → English → raw key string.

**Font** — Controls use the CSS variable `--font-display` for their text rendering.
The variable is set on `:root` by the Font selector:

| Font choice  | `--font-display` value |
|-------------|------------------------|
| 7-Segment   | `"DSEG7Classic", "Orbitron", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Orbitron    | `"Orbitron", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| System      | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |

The cascade provides graceful degradation: if 7-Segment fails to load, Orbitron is
tried; if that also fails, the OS system font is used.

### 1.3 Fonts — What Is the "System Font"?

There is **no single default font** across browsers. Each OS provides its own:

| OS          | System font        |
|-------------|--------------------|
| macOS / iOS | San Francisco (SF Pro) |
| Windows     | Segoe UI           |
| Android     | Roboto             |
| Linux       | Varies (Cantarell, Noto Sans, DejaVu Sans) |

The CSS keyword `system-ui` resolves to whichever the OS provides. The full fallback
stack `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` covers all major
platforms. `Arial`, `Helvetica`, and `Times New Roman` are legacy web-safe fonts, not
the actual system UI font on any modern OS.

**Custom fonts for this project:**

| Font | Source | File | Usage |
|------|--------|------|-------|
| **DSEG7 Classic** | [github.com/keshikan/DSEG](https://github.com/keshikan/DSEG) | `DSEG7Classic-Regular.woff2` | Digital/LED display look |
| **Orbitron** | [Google Fonts](https://fonts.google.com/specimen/Orbitron) | `Orbitron-VariableFont.woff2` | Futuristic/tech look |

Both are free/open-source. We will download the `.woff2` files and place them in
`public/assets/fonts/`, with `@font-face` declarations in `layout.css`.

---

## 2. Authentication

### 2.1 Local Development

| Component  | Detail |
|------------|--------|
| **Server** | `server.js` — Express, reads `.env` via `dotenv` |
| **Login route** | `POST /api/login` — compares body `{user, pass}` to `process.env.LOGIN_USER / LOGIN_PASS` |
| **Session** | On success, sets a signed `HttpOnly` cookie `token=<jwt or random>` |
| **Guard** | Express middleware on `GET /index.html` (and all non-login assets): if no valid cookie → 302 to `/login.html` |
| **Logout** | `GET /api/logout` clears cookie, redirects to `/login.html` |
| **.env** | `LOGIN_USER=demo`  `LOGIN_PASS=demo`  `SESSION_SECRET=<random>` |

### 2.2 Vercel Deployment

| Component | Detail |
|-----------|--------|
| **Serverless function** | `api/login.js` — same logic, reads from Vercel env vars |
| **Middleware** | `vercel.json` rewrites — or Edge Middleware (`middleware.js` at root) checking the cookie on every non-`/login*` request |
| **Env vars** | Set `LOGIN_USER`, `LOGIN_PASS`, `SESSION_SECRET` in Vercel dashboard |

### 2.3 Login Page Design

- Centred card on a dark background.
- Two fields: **Username**, **Password** + **Sign In** button.
- Error message area below the button.
- Styled with `login.css` using the current palette tokens.

---

## 3. Two-Panel Window Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌────────────────────────────────────────────────┐ │
│  │              │  │                                                │ │
│  │   GLOBAL     │  │              PREVIEW PANEL                     │ │
│  │   CONTROLS   │  │         (scrollable if needed)                 │ │
│  │   PANEL      │  │                                                │ │
│  │              │  │                                                │ │
│  │  (fixed-     │  │                                                │ │
│  │   width,     │  │                                                │ │
│  │  non-scroll- │  │                                                │ │
│  │   able)      │  │                                                │ │
│  │              │  │                                                │ │
│  └──────────────┘  └────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

| Property          | Left Panel              | Right Panel                     |
|-------------------|-------------------------|---------------------------------|
| Width             | `280px` fixed           | `1fr` (fills remaining)         |
| Height            | `100vh`                 | `100vh`                         |
| Overflow          | `overflow: hidden`      | `overflow-y: auto`              |
| CSS               | `layout.css` → `.panel-left` | `layout.css` → `.panel-right` |
| Background        | Slightly different shade from main bg for visual separation |

`index.html` body uses `display: grid; grid-template-columns: 280px 1fr; height: 100vh;`.

---

## 4. Left Panel — Global Controls

All controls in the left panel are `<segmented-control>` Web Components (extended
with `disabled-options` attribute for greying out unavailable choices) plus a custom
colour picker at the bottom.

### 4.a Language

| Label | Grid | Values | Initially enabled |
|-------|------|--------|-------------------|
| **Language** | 2 rows × 4 cols | EN, ES, FR, DE, RU, KO, JP, CN | EN, ES only |

- On change → load corresponding `i18n/<code>.json`, iterate all elements with
  `data-i18n="key"` attributes and replace their `textContent`.
- Each JSON file has identical keys; value is the translated caption.

```jsonc
// i18n/en.json (example excerpt)
{
  "title_header1": "Title (Header 1)",
  "header2": "Header 2",
  "btn_play": "Play",
  "btn_pause": "Pause",
  "label_volume": "Volume",
  "notif_note": "Note",
  "notif_message": "Message",
  // ...
}
```

### 4.b Style

| Label | Grid | Values | Initially enabled |
|-------|------|--------|-------------------|
| **Style** | 2 rows × 3 cols | Basic, Flat, Gradient, Volume, Grooves, Shadows | Volume only |

- On change → `style-manager.js` swaps the `<link>` stylesheet and, if needed,
  fires a `style-changed` event so canvas-based controls can repaint.

### 4.c Font

| Label | Grid | Values | Initially enabled |
|-------|------|--------|-------------------|
| **Font** | 1 row × 3 cols | 7-Segment, Orbitron, System | all enabled |

- On change → sets `--font-display` CSS variable on `:root`.
- System = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

### 4.d Theme

| Label | Grid | Values | Initially enabled |
|-------|------|--------|-------------------|
| **Theme** | 1 row × 3 cols | Dark, Light, Both | all enabled |

- Dark / Light → single-column preview in the right panel with that theme. Global controls panel adjusts accordingly.
- Both → right panel shows a **side-by-side split**: left half Dark, right half Light,
  each containing the full showcase. Global controls panel stays Dark.
- Theme switch triggers palette regeneration (gen_colors.js produces both light and
  dark background/foreground variants anyway).

### 4.e Saturation

| Label | Grid | Values | Initially enabled |
|-------|------|--------|-------------------|
| **Saturation** | 1 row × 2 cols | Accents only, Whole layout | all enabled |

- **Accents only** — `gen_colors.js` sets `--bg`, `--fg`, `--neutral-*`, `--panel-*`,
  `--edge-*` to greyscale values; only `--primary-accent-*` and
  `--secondary-accent-*` carry chroma.
- **Whole layout** — all tokens are chromatic, derived from the main seed colour's hue.

### 4.f Colour Palette

| Label | Grid | Values | Initially enabled |
|-------|------|--------|-------------------|
| **Colour Palette** | 5 rows × 3 cols | Ruby, Gold, Anthracite / Amber, Onyx, Malachite / Emerald, Topaz, Sapphire / Amethyst, Opal, Pearl / Marble, Quartz, Diamond | all enabled |

Grid layout (warm → cool → neutral progression):

| | Col 1 | Col 2 | Col 3 |
|---|---|---|---|
| Row 1 | Ruby | Gold | Anthracite |
| Row 2 | Amber | Onyx | Malachite |
| Row 3 | Emerald | Topaz | Sapphire |
| Row 4 | Amethyst | Opal | Pearl |
| Row 5 | Marble | Quartz | Diamond |

- Each palette name maps to a predefined triplet `(main, accent-dark, accent-light)` in `palettes.js`.
- On change → feeds the triplet into `gen_colors.js`, which regenerates CSS tokens.

### 4.g Colour Editor

Placed directly below the Colour Palette segmented control:

1. **Triple-colour selector** (`<color-picker>`) — a single widget showing three
   colour swatches labelled **Main**, **Acc1** (accent-dark), **Acc2** (accent-light),
   plus one **All** toggle to edit them in a unified hue-ring view.
   - Clicking a swatch opens a small OKLCh-based picker (hue ring + lightness/chroma
     rectangle).
   - Dragging any swatch immediately regenerates the live palette.

2. **Palette metadata fields** (editable text inputs):
   - **Gems name** (e.g. "Amber")
   - **Natural name** (e.g. "Spring")
   - **Flower name** (e.g. "Daisy")
   - **Beverage name** (e.g. "Beer")
   - Each has a small pencil-icon edit button.

3. **Save / Reset** buttons:
   - **Save** — rewrites the current custom palette + metadata in project palettes file.
   - **Reset** — reverts to the last saved palette for the selected name.

4. **Export Palettes / Import** buttons:
   - **Export Palettes** — downloads a JSON file with full generated colour tokens,
     localized names for all 8 languages, and seed data. Filename includes the current
     saturation mode as a suffix (e.g. `amber-palette-accents-only.json`). See §6.7.
   - **Import** — opens a file picker to load a previously exported palette JSON.
     On import, seeds are extracted and palette is regenerated / applied.

### 4.h Disable All Toggle

Moved from the bottom-right corner to the left panel (at the very top or very bottom).
Flat checkbox, same design as current — toggles `disabled` on every control in the
preview panel.

---

## 5. Style Modules — Consistency Contract

Every style CSS file (`basic.css`, `flat.css`, … `shadows.css`) **must** define
overrides/values for the same set of CSS custom properties and classes. A checklist:

```
Style-Tokens (CSS custom properties each style file must set):
  --ctrl-border-radius
  --ctrl-border-width
  --ctrl-bg
  --ctrl-bg-hover
  --ctrl-bg-active
  --ctrl-fg
  --ctrl-edge
  --ctrl-shadow
  --ctrl-gradient-angle
  --ctrl-gradient-start
  --ctrl-gradient-end
  --ctrl-inner-gradient-start    (volume/grooves/shadows only, others = flat fill)
  --ctrl-inner-gradient-end
  --ctrl-groove-depth            (grooves/shadows only, others = 0)
  --ctrl-shadow-offset-x         (shadows only, others = 0)
  --ctrl-shadow-offset-y
  --ctrl-shadow-blur
  --ctrl-shadow-color

Element classes each file must style:
  .ctrl-button
  .ctrl-button--pressed
  .ctrl-button--disabled
  .ctrl-segment
  .ctrl-segment--selected
  .ctrl-toggle-track
  .ctrl-toggle-thumb
  .ctrl-slider-track
  .ctrl-slider-thumb
  .ctrl-checkbox
  .ctrl-radio
  .ctrl-input
  .ctrl-dropdown
  .ctrl-notification
  .ctrl-notification--note
  .ctrl-notification--message
  .ctrl-notification--success
  .ctrl-notification--warning
  .ctrl-notification--error
  .ctrl-card
  .ctrl-panel
  .ctrl-gauge
  .ctrl-chart
```

> **Rule**: Before adding a new styled element, add its class name to this checklist
> first, then implement it in **all six** style files. Stub styles (copying from the
> nearest simpler style) are acceptable for disabled styles.

---

## 6. Colour Palette System

The palette system has three layers:

1. **`palettes.js`** — compact seed data (names + 3 hex colours per palette).
2. **`gen_colors.js`** — algorithmic engine that expands seeds into full token sets.
3. **Export** — "Export Palettes" button that downloads a ready-to-reuse JSON file.

### 6.1 Palette Seeds (`palettes.js`)

Each palette is stored as a compact record with four themed names and an `accents`
array of **2, 3, or more** seed hex colours. The `main` colour's **hue** and **chroma**
determine background/neutral tints (its lightness is overridden by the algorithm).

- **2 accents** `[dark, light]` — `gen_colors.js` interpolates 5 stops along the OKLCh path.
- **3 accents** `[dark, mid, light]` — engine interpolates via the midpoint for better control.
- **5+ accents** — used as-is for `--primary-accent-1..N` (no interpolation needed).

```js
// js/palettes.js
export const PALETTES = {

  // ── 1. Ruby ───────────────────────────────────────────────────────
  // Noble reds on muted indigo-slate. Classic luxury pairing.
  ruby: {
    gems: "Ruby", natural: "Sunset", flower: "Rose", beverage: "Wine",
    main:    "#3a4160",       // Muted indigo-slate (desaturated navy)
    accents: ["#9b2335",      // Deep crimson-ruby
              "#e04858"],     // Vibrant rose-red
    special: null,
  },

  // ── 2. Gold ───────────────────────────────────────────────────────
  // Warm burnished orange-to-gold on muted navy. Regal and warm.
  gold: {
    gems: "Gold", natural: "Desert", flower: "Sunflower", beverage: "Bourbon",
    main:    "#38405a",       // Muted navy-slate
    accents: ["#c07828",      // Burnished reddish-orange
              "#f0c038"],     // Rich yellow-gold
    special: null,
  },

  // ── 3. Anthracite ─────────────────────────────────────────────────
  // Orange-gold accents on dark olive-sage. Earthy and organic.
  anthracite: {
    gems: "Anthracite", natural: "Spring", flower: "Daisy", beverage: "Brandy",
    main:    "#4a5240",       // Dark olive-sage green
    accents: ["#b87830",      // Warm burnt-orange
              "#e8c450"],     // Golden yellow
    special: null,
  },

  // ── 4. Amber ──────────────────────────────────────────────────────
  // Amber-orange-to-gold on warm umber. The default/reference palette.
  amber: {
    gems: "Amber", natural: "Autumn", flower: "Marigold", beverage: "Whisky",
    main:    "#6a5238",       // Warm umber brown
    accents: ["#d08028",      // Amber-orange
              "#f0c030"],     // Bright golden amber
    special: null,
  },

  // ── 5. Onyx ───────────────────────────────────────────────────────
  // Olive-green accents on coffee-brown. Earthy and grounded.
  onyx: {
    gems: "Onyx", natural: "Mountain", flower: "Olive", beverage: "Coffee",
    main:    "#5a4a38",       // Warm coffee-brown
    accents: ["#688030",      // Dark olive green
              "#a8c048"],     // Bright olive-chartreuse
    special: null,
  },

  // ── 6. Malachite ──────────────────────────────────────────────────
  // Cyan → green → orange on neutral teal-grey. Jungle-botanical feel.
  malachite: {
    gems: "Malachite", natural: "Forest", flower: "Ginkgo", beverage: "Mojito",
    main:    "#485858",       // Neutral teal-grey
    accents: ["#20a8a0",      // Teal-cyan
              "#288858",      // Malachite green
              "#d09838"],     // Warm orange-gold
    special: null,
  },

  // ── 7. Emerald ────────────────────────────────────────────────────
  // Violet-blue-to-teal gradient on clinical blue-grey.
  // Designed for clinic/medical web applications — calming and trustworthy.
  emerald: {
    gems: "Emerald", natural: "Monsoon", flower: "Eucalyptus", beverage: "Absinthe",
    main:    "#3d4d68",       // Calm clinical blue-grey
    accents: ["#2870a8",      // Deep clinical blue
              "#38c0a8"],     // Fresh teal-cyan
    special: null,
  },

  // ── 8. Topaz ──────────────────────────────────────────────────────
  // Tron Legacy–inspired: bright cyan glow on dark steel-blue.
  // Ref: metallic aquamarine #18cae6, desaturated dark backgrounds.
  topaz: {
    gems: "Topaz", natural: "Lagoon", flower: "Iris", beverage: "Tonic",
    main:    "#283848",       // Dark steel-blue (Tron grid tone)
    accents: ["#0890c0",      // Medium Tron blue
              "#40e0f0"],     // Bright Tron cyan glow
    special: null,
  },

  // ── 9. Sapphire ───────────────────────────────────────────────────
  // Blue-to-cyan on noble muted purple. Deep-sea elegance.
  sapphire: {
    gems: "Sapphire", natural: "Midnight", flower: "Lavender", beverage: "Curaçao",
    main:    "#403060",       // Noble muted purple
    accents: ["#2858b0",      // Deep sapphire blue
              "#48b8e0"],     // Bright sky-cyan
    special: null,
  },

  // ── 10. Amethyst ──────────────────────────────────────────────────
  // Dark-pink-to-gold on deep purple. Rich and dramatic.
  amethyst: {
    gems: "Amethyst", natural: "Twilight", flower: "Orchid", beverage: "Cognac",
    main:    "#483060",       // Deep purple
    accents: ["#a03068",      // Dark orchid-magenta
              "#d8a840"],     // Warm cognac-gold
    special: null,
  },

  // ── 11. Opal ──────────────────────────────────────────────────────
  // Dark-pink-to-peach on muted slate-blue. Warm dusk glow.
  opal: {
    gems: "Opal", natural: "Dusk", flower: "Camellia", beverage: "Liquor",
    main:    "#384560",       // Muted slate-blue
    accents: ["#b03858",      // Dark camellia pink
              "#f0b090"],     // Soft peach
    special: null,
  },

  // ── 12. Pearl ─────────────────────────────────────────────────────
  // Pastel rainbow on pink-violet grey. Soft, luminous, feminine.
  pearl: {
    gems: "Pearl", natural: "Morning", flower: "Sakura", beverage: "Latte",
    main:    "#584858",       // Neutral pink-violet grey
    accents: ["#fff9b8",      // Pastel lemon
              "#ffc88a",      // Pastel peach-orange
              "#a8d8ff"],     // Pastel sky-blue
    special: null,
  },

  // ── 13. Marble ────────────────────────────────────────────────────
  // Rose-to-teal complementary on blue-grey. Designed for hospital/healthcare
  // web applications — caring warmth balanced with clinical cool.
  marble: {
    gems: "Marble", natural: "Mist", flower: "Maple", beverage: "Cider",
    main:    "#485060",       // Neutral blue-grey
    accents: ["#c04870",      // Warm rose-pink
              "#40c0a8"],     // Fresh teal-cyan
    special: null,
  },

  // ── 14. Quartz ────────────────────────────────────────────────────
  // Monokai / Gruvbox–inspired: 7 explicit accent colours on warm olive-dark.
  // Ref: Gruvbox bright_* palette from github.com/morhetz/gruvbox.
  quartz: {
    gems: "Quartz", natural: "Typhoon", flower: "Oak", beverage: "Gin",
    main:    "#32302f",       // Warm olive-dark grey (Gruvbox dark0_soft)
    accents: ["#fb4934",      // Gruvbox bright-red
              "#fe8019",      // Gruvbox bright-orange
              "#fabd2f",      // Gruvbox bright-yellow
              "#b8bb26",      // Gruvbox bright-green
              "#8ec07c",      // Gruvbox bright-aqua
              "#83a598",      // Gruvbox bright-blue
              "#d3869b"],     // Gruvbox bright-purple
    special: null,
  },

  // ── 15. Diamond ───────────────────────────────────────────────────
  // Monochrome: all neutrals with minimal chroma. Subtle cool-steel tint.
  diamond: {
    gems: "Diamond", natural: "Arctic", flower: "Edelweiss", beverage: "Schnapps",
    main:    "#686870",       // Neutral mid-grey (faintest cool tint)
    accents: ["#404048",      // Dark steel-grey
              "#b8b8c0"],     // Light steel-grey
    special: { primaryFromLightness: true },
  },
};
```

The `special` field is a placeholder for palettes that need non-standard rules
(e.g. monochrome palettes like Diamond where accent-dark ≈ accent-light in chroma and
primary/secondary accents need different derivation logic). When `special` is non-null,
`gen_colors.js` checks it and applies alternative generation rules (see §6.5).

### 6.2 Colour Space — OKLCh

All interpolation done in **OKLCh** (perceptually uniform, cylindrical):
- Convert hex → sRGB → OKLab → OKLCh.
- Interpolate L (lightness), C (chroma), h (hue) independently.
- Convert back OKLCh → OKLab → sRGB → hex.

### 6.3 Generated Tokens

`gen_colors.js` takes the 3 seed colours + saturation mode and produces two complete
token sets: one for Dark theme, one for Light theme.

| Token family | Count | Derivation |
|---|---|---|
| `--primary-accent-1..N` | 5–7 | From `accents[]`: interpolated (2–3 seeds → 5 stops) or used as-is (5+ seeds) |
| `--secondary-accent-1..5` | 5 | `main` with lightness shifted ±10%, ±20% (darker and lighter) |
| `--bg` | 1 | Very low lightness version of `main` (Dark: L ≈ 0.10, Light: L ≈ 0.95) |
| `--fg` | 1 | Opposite end (Dark: L ≈ 0.90, Light: L ≈ 0.15) |
| `--neutral-1..4` | 4 | Evenly spaced lightness between `--bg` and `--fg` |
| `--panel-bg`, `--panel-edge` | 2 | Slight offsets from `--bg` |
| `--edge-1`, `--edge-2` | 2 | Subtle border colours |

**Primary and secondary accents are identical for both Dark and Light themes.** This
ensures visual consistency when the user switches theme. Only the background, foreground,
neutral, panel, and edge tokens differ between themes.

**Saturation modes:**
- `"Whole layout"` — all tokens retain chroma from the `main` hue.
- `"Accents only"` — `--bg`, `--fg`, `--neutral-*`, `--panel-*`, `--edge-*` have
  chroma forced to 0 (pure greyscale at same lightness); only `--primary-accent-*` and
  `--secondary-accent-*` keep their chroma.

### 6.4 Brightness Normalisation

For any `main` colour, the background and foreground tokens are pinned to fixed OKLCh
lightness levels (Dark bg: L=0.10, Light bg: L=0.95, etc.). This ensures consistent
perceived brightness across palettes regardless of the seed hue. The neutrals are
evenly spaced between bg and fg lightness levels, so all palettes produce similar
contrast ratios.

### 6.5 Special-Case Palettes

Some palettes (e.g. Onyx, Diamond, Marble) are nearly monochrome — their accent-dark
and accent-light may be very close or identical. For these, the `special` field in
`palettes.js` can specify alternative rules:

```js
special: {
  // For monochrome palettes: derive primary accents from lightness variations only
  primaryFromLightness: true,
  // For pastel palettes: reduce chroma multiplier for secondary accents
  secondaryChromaScale: 0.5,
}
```

`gen_colors.js` checks `special` before generating and applies these overrides.
This is a forward-looking extension point — initially only standard palettes are used.

### 6.6 API

```js
// gen_colors.js
export function generatePalette(main, accents, {
  saturationMode = 'accents-only',  // 'accents-only' | 'whole-layout'
  theme = 'dark',                    // 'dark' | 'light' | 'both'
  special = null,                    // override rules or null
}) {
  // Returns: {
  //   dark:  { [tokenName]: hexString, ... },   // always generated
  //   light: { [tokenName]: hexString, ... },   // always generated
  // }
}

export function applyPalette(tokenMap, theme = 'dark') {
  // Sets tokenMap[theme] as CSS custom properties on :root
  // Dispatches 'palette-changed' event for canvas-based controls
}
```

### 6.7 Palette Export / Import

An **"Export Palettes"** button in the left panel (below Save/Reset) downloads a
self-contained JSON file with all generated colour tokens, ready to drop into another
project.

**Exported file format:**

```jsonc
// amber-palette-accents-only.json
{
  "meta": {
    "generator": "webappcontrols/gen_colors.js",
    "saturationMode": "accents-only",
    "seeds": { "main": "#6a5238", "accents": ["#d08028", "#f0c030"] }
  },
  "names": {
    "en": { "gems": "Amber",  "natural": "Spring", "flower": "Daisy",  "beverage": "Beer" },
    "es": { "gems": "Ámbar",  "natural": "Primavera", "flower": "Margarita", "beverage": "Cerveza" },
    "fr": { "gems": "Ambre",  "natural": "Printemps", "flower": "Pâquerette", "beverage": "Bière" },
    "de": { "gems": "Bernstein", "natural": "Frühling", "flower": "Gänseblümchen", "beverage": "Bier" },
    "ru": { "gems": "Янтарь", "natural": "Весна", "flower": "Маргаритка", "beverage": "Пиво" },
    "ko": { "gems": "호박",   "natural": "봄",    "flower": "데이지",  "beverage": "맥주" },
    "jp": { "gems": "琥珀",   "natural": "春",    "flower": "デイジー", "beverage": "ビール" },
    "cn": { "gems": "琥珀",   "natural": "春天",  "flower": "雏菊",    "beverage": "啤酒" }
  },
  "dark": {
    "--bg": "#0f1210",
    "--fg": "#e8ede9",
    "--neutral-1": "#2a2f2b",
    "--primary-accent-1": "#ee7f09",
    "...": "..."
  },
  "light": {
    "--bg": "#f5f2ed",
    "--fg": "#1a1815",
    "--neutral-1": "#d5d0c8",
    "--primary-accent-1": "#ee7f09",
    "...": "..."
  }
}
```

**File naming convention** — auto-generated with a saturation-mode suffix to prevent
confusion between the two variants:

| Saturation mode | Filename |
|-----------------|----------|
| Accents only    | `<palette>-palette-accents-only.json` |
| Whole layout    | `<palette>-palette-whole-layout.json` |

Example: `amber-palette-accents-only.json`, `ruby-palette-whole-layout.json`.

**Import** — The app also accepts importing a previously exported JSON via a file
picker. On import, `gen_colors.js` reads the `seeds` and regenerates (or directly
applies the pre-computed tokens). This allows round-tripping palettes between projects.

### 6.8 Localized Palette Names

Each palette's four name variants (gems, natural, flower, beverage) are translated for
all 8 supported languages. These translations live in `palettes.js` alongside the seeds:

```js
amber: {
  gems: "Amber", natural: "Spring", flower: "Daisy", beverage: "Beer",
  names_i18n: {
    es: { gems: "Ámbar", natural: "Primavera", flower: "Margarita", beverage: "Cerveza" },
    fr: { gems: "Ambre", natural: "Printemps", flower: "Pâquerette", beverage: "Bière" },
    // ... other languages ...
  },
  main: "#b8860b", accentDark: "#ee7f09", accentLight: "#ffce1b",
  special: null,
},
```

When exporting, all localized names are included in the JSON (see §6.7 example).
When displaying palette names in the colour editor, the current language is used.
Fallback: if a translation is missing → English name.

---

## 7. Right Panel — Preview Layout (from sketch)

The preview area is divided into **three vertical panels** that together showcase all
major web UI elements. Below is the column-by-column breakdown.

A container panel itself should be a styled element. We may need several versions of panels, but showcasing only one of them. 
Suggested versions: visible, invisible (container only), fixed width/height (% of parent container sizes), or filling full available space inside a parent, versions with fixed height and allowed scrolling for content and versions with floating height but no scrolling allowed. 

```
┌───────────────────────────────────────────────────────────────┐
│ PANEL A               │ PANEL B            │ PANEL C          │
│ Text & Buttons &      │ Vertical and       │ Charts &         │
│ Inputs & Knobs        │ Horizontal Sliders │ Calendars        │
│                       │ & Notifications    │                  │
└───────────────────────────────────────────────────────────────┘
```

### Panel A — Typography, Buttons, Inputs, Toggles, Knobs

From top to bottom:

| # | Element | Details |
|---|---------|---------|
| A1 | **Title (H1)** | `<h1>` styled text |
| A2 | **Header 2** | `<h2>` |
| A3 | **Header 3 + Body text** | `<h3>` alongside a paragraph of lorem ipsum |
| A4 | **Text field (enabled)** | `<text-field>` with placeholder |
| A5 | **Text field (disabled)** | `<text-field disabled>` |
| A6 | **Buttons row 1** | Three `<push-button>`: pressed, not-pressed, disabled — primary accent |
| A7 | **Buttons row 2** | One `<push-button>` — secondary accent variant |
| A8 | **Counting buttons (primary)** | Row of square `<push-button>` labelled 2000..2004 — secondary colour |
| A9 | **Counting buttons (secondary)** | Row of square `<push-button>` labelled 1000..1004 |
| A10 | **Checkboxes** | 3× `<check-box>` (checked, unchecked, indeterminate) |
| A11 | **Radio buttons** | 3× `<radio-button>` in a group |
| A12 | **Toggle switches** | 2 rows × 3 columns of `<toggle-switch>` (various sizes/states) |
| A13 | **Rotary knobs** | 2–3 `<rotary-knob>` (continuous + enum modes, large size) |

### Panel B — Vertical,  Horizontal Sliders & Notifications

| # | Element | Details |
|---|---------|---------|
| B1 | **Vertical sliders** | 5–6 `<vertical-slider>` side by side, various values |
| B2 | **Horizontal range slider** | `<range-slider>` with a single thumb + accent fill |
| B3 | **Range selector** | `<range-selector>` (two thumbs) |
| B4 | **Progress bars** | 2–3 `<progress-bar>` at different levels |
| B5 | **Horizontal sliders** | Additional `<range-slider>` variants (thin, thick, stepped) |
| B6 | **Notification: Note** | `<notification type="note">` with squiggly placeholder text |
| B7 | **Notification: Message** | `<notification type="message">` |
| B8 | **Notification: Success** | `<notification type="success">` |
| B9 | **Notification: Warning** | `<notification type="warning">` |
| B10 | **Notification: Error** | `<notification type="error">` |

###  Panel C — Charts & Calendars

| # | Element | Details |
|---|---------|---------|
| C1 | **Bar chart** | `<bar-chart>` — 7 bars (Mon–Sun) |
| C2 | **Line chart** | `<line-chart mode="line">` — single series |
| C3 | **Area chart** | `<line-chart mode="area">` — filled area variant |
| C4 | **Scatter / bubble chart** | `<line-chart mode="scatter">` or dedicated `<scatter-chart>` |
| C5 | **Calendar (date)** | `<dropdown-calendar mode="single">` — expanded view |
| C6 | **Calendar (date range)** | `<dropdown-calendar mode="range">` — expanded view |

### Layout CSS

```css
.panel-right {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr;
  gap: 24px;
  padding: 24px;
  overflow-y: auto;
}
.col-a, .col-b, .col-c {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

---

## 8. i18n — Internationalisation Module

### Design

- Each language file (`i18n/en.json`, `i18n/es.json`, …) maps string keys to translated
  values.
- Every text-bearing HTML element or Web Component that should be translated gets a
  `data-i18n="key"` attribute.
- A lightweight `i18n.js` module:

```js
let currentStrings = {};

export async function loadLanguage(code) {
  const resp = await fetch(`js/i18n/${code}.json`);
  currentStrings = await resp.json();
  applyAll();
}

export function t(key) {
  return currentStrings[key] ?? key;
}

function applyAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  // Also fire a custom event so Web Components can update internal labels
  document.dispatchEvent(new CustomEvent('language-changed', { detail: currentStrings }));
}
```

- Web Components listen for `language-changed` on `document` and re-render labels.

### Key Catalogue (initial — grows with controls)

```
title_header1, header2, header3, body_lorem,
btn_pressed, btn_not_pressed, btn_disabled, btn_secondary,
label_volume, label_day, label_speed,
notif_note_title, notif_message_title, notif_success_title, notif_warning_title, notif_error_title,
cal_date, cal_date_range,
chart_bar_title, chart_line_title, chart_area_title,
...
```

---

## 9. Implementation Phases

### Phase 0 — Scaffolding & Auth (local first)

- [x] **0.1** Create `package.json` with `express`, `dotenv`, `cookie-parser`, `jsonwebtoken` deps.
- [x] **0.2** Create `.env` with `LOGIN_USER=demo`, `LOGIN_PASS=demo`, `SESSION_SECRET=...`.
- [x] **0.3** Create `server.js` — Express app serving `public/`, auth middleware, `POST /api/login`, `GET /api/logout`.
- [x] **0.4** Create `public/login.html` + `public/css/login.css`.
- [x] **0.5** Create `public/js/auth.js` — client-side cookie check, redirect logic.
- [x] **0.6** Test locally: `npm run dev` → login page → demo → logout.

### Phase 1 — Two-Panel Layout Shell & Fonts

- [x] **1.1** Download DSEG7 Classic and Orbitron `.woff2` files to `public/assets/fonts/`.
- [x] **1.2** Create `public/css/layout.css` with grid layout, panel styles, `@font-face` declarations.
- [x] **1.3** Rewrite `public/index.html` to two-panel structure (left + right).
- [x] **1.4** Populate left panel with all segmented controls (Language, Style, Font, Theme, Saturation, Colour Palette) — wired to fire events but no backend logic yet.
- [x] **1.5** Move Disable All toggle into the left panel.
- [x] **1.6** Stub right panel with placeholder panels (A, B, C) and empty slots labelled with the control types they will contain.

### Phase 2 — Palette Seeds & Colour Engine

- [x] **2.1** Create `palettes.js` — all 15 palette seeds with flexible `accents[]` arrays.
- [x] **2.2** Implement `gen_colors.js` — OKLCh conversions + `generatePalette()` + `applyPalette()`.
- [x] **2.3** Wire Colour Palette grid to `gen_colors.js` (via `app.js`).
- [x] **2.4** Implement saturation mode toggle ("Accents only" vs "Whole layout").
- [x] **2.5** Update `tokens.css` to use the generated variables instead of hardcoded hex.
- [x] **2.6** Implement colour picker widget (`<color-picker>` with three-swatch + OKLCh hue ring).
- [x] **2.7** Implement palette metadata fields (4 names) + Save/Reset buttons.
- [x] **2.8** Implement Export Palettes button (JSON download with saturation-mode suffix).
- [x] **2.9** Implement Import button (file picker, seed extraction, palette regeneration).

### Phase 3 — Per-Style Control Bundles

- [x] **3.1** All styles share flat.js Web Components; visual differences via CSS custom properties only.
- [x] **3.2** Create `public/css/styles/volume.css` — pseudo-3D gradient style tokens.
- [x] **3.3** Create `public/css/styles/basic.css` — stripped-down browser defaults.
- [x] **3.4** Create `public/js/controls/flat.js` + `public/css/styles/flat.css` — solid fills, no gradients.
- [x] **3.5** Create stubs for `gradient.css`, `grooves.css`, `shadows.css`.
- [x] **3.6** Implement `style-manager.js` — live CSS `<link>` swap (no reload needed).
- [x] **3.7** Wire the Style segmented control to `style-manager.js`.

### Phase 4 — i18n

- [x] **4.1** Create `i18n.js` loader module with `loadLanguage()`, `t()`, fallback chain (selected → EN → raw key).
- [x] **4.2** Create `en.json` and `es.json` with full key catalogue.
- [x] **4.3** Create placeholder JSONs for disabled languages (FR, DE, RU, KO, JP, CN).
- [x] **4.4** Add `data-i18n` attributes to all static text in `index.html`.
- [x] **4.5** Wire Language segmented control to `loadLanguage()`.
- [x] **4.6** Add localized palette names for all 8 languages to `palettes.js`.

### Phase 5 — Font & Theme Switching

- [x] **5.1** Wire Font segmented control to set `--font-display` on `:root` with fallback chain.
- [x] **5.2** Implement Dark/Light theme switching — regen palette, swap `data-theme` on body, adjust global controls panel accordingly.
- [x] **5.3** Implement "Both" mode — split right area into two halves (Dark left, Light right), each with all preview panels. Global controls panel stays Dark.

### Phase 6 — Right Panel Controls (Panel A)

- [x] **6.1** Typography showcase (H1, H2, H3, body text).
- [x] **6.2** Text fields (enabled + disabled).
- [x] **6.3** Push buttons (pressed, not-pressed, disabled, secondary accent).
- [x] **6.4** Counting/square buttons (two rows).
- [x] **6.5** Checkboxes.
- [x] **6.6** Radio buttons.
- [x] **6.7** Toggle switches (grid of variants).
- [x] **6.8** Rotary knobs (existing canvas-based component).

### Phase 7 — Right Panel Controls (Panel B)

- [x] **7.1** Create `<vertical-slider>` Web Component (inside each per-style bundle).
- [x] **7.2** Add 5–6 vertical sliders with different values.
- [x] **7.3** Horizontal slider, range selector, progress bars.
- [x] **7.4** Create `<notification>` Web Component with type variants (note/message/success/warning/error).
- [x] **7.5** Add all 5 notification types.

### Phase 8 — Right Panel Controls (Panel C)

- [x] **8.1** Create `<bar-chart>` Web Component (canvas-based).
- [x] **8.2** Create `<line-chart>` Web Component (line / area modes, canvas-based).
- [x] **8.3** Create `<date-calendar>` Web Component with month navigation and date selection.

### Phase 9 — Polish, Tuning & Additional Styles

- [ ] **9.1** Visual QA: test all 15 palettes × 2 saturation modes × 2 themes — verify contrast ratios, accent visibility, and overall balance.
- [ ] **9.2** Tune palette seeds if any produce poor results (especially Malachite green→orange interpolation, Amethyst pink→gold, and Diamond monochrome).
- [ ] **9.3** Implement special-case rules in `gen_colors.js` for Diamond (monochrome) and any other palettes that need non-standard derivation.
- [ ] **9.4** Add localized names (all 8 languages) for all 15 palettes in `palettes.js`.
- [ ] **9.5** Enable remaining Style options (Gradient, Grooves, Shadows) progressively.

### Phase 10 — Vercel Deployment

- [ ] **10.1** Create `vercel.json` with routes, rewrites, and serverless function config.
- [ ] **10.2** Create `api/login.js` serverless function.
- [ ] **10.3** Add Edge Middleware or rewrite rules for auth guard.
- [ ] **10.4** Test deployment on Vercel.
- [ ] **10.5** Update `README.md` with deployment instructions, screenshots, usage guide.

---

## 10. Open Design Questions

1. **Colour picker widget** — Should the three-swatch picker use a circular hue ring
   with a rectangular L×C area, or a simpler HSL strip? OKLCh ring is more accurate but
   more complex to build.

   A: Let us try the variant with circular hue ring first.

2. **"Both" theme mode** — Full duplicate of all controls in side-by-side panels, or a
   simulated split with one panel having `mix-blend-mode` / CSS filter trickery?
   Duplicating is simpler and more reliable.

   A: Yes, split the right area into two areas and arrange all web ui element-containing panels vertically in each of those two areas.

3. **Canvas-based vs CSS-based controls** — Existing `rotary-knob` uses `<canvas>`.
   Should all new controls follow the same approach, or should simpler controls
   (buttons, checkboxes, etc.) use pure HTML/CSS with Shadow DOM? Recommendation:
   use CSS for simple controls, canvas for complex ones (knobs, gauges, charts).

   A. Use CSS for simple controls, canvas for complex ones (knobs, gauges, charts). I think this will make the optimal balance for performance.

4. **Responsive behaviour** — Should the right panel reflow to fewer columns on narrow
   viewports, or is this strictly a desktop-first showcase?

   A. Let us make it desktop-first for now.

5. **Palette presets storage** — Should custom palettes be exportable/importable as JSON
   files, or is `localStorage` sufficient for v1?

   A. Let us make them exportable/importable as JSON files.
