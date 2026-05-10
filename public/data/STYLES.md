# Web App Controls — Style Bundle Integration Guide

A self-contained bundle of CSS tokens, a dynamic colour-palette engine, and a
catalogue of themed Web Components. Drop it into any web project to instantly
gain a coherent, palette-driven visual style with built-in Dark/Light theming
and i18n support.

> **What's in the bundle**
>
> - One CSS style flavour: **Flat**, **Gradient**, **Volume**, or **Glow**
> - 15 colour palettes (Ruby, Gold, Topaz, Amber, …) with localised names
> - A palette engine that generates every shade and gradient stop you need
> - A library of ready-made Web Components (buttons, sliders, gauges, charts,…)
> - Lightweight i18n helper + JSON language packs (9 languages)
>
> **Theme variants:** every palette ships in **Dark/Light × Tinted/Accented** (4 variants).
> The bundle's defaults expose **Tinted** only and toggle Dark/Light via
> `<html data-theme="dark|light">`.

---

## 1. Bundle layout

After unzipping `{Style}_modules.zip` you get:

```
{Style}_modules/
├── STYLES.md                    ← this guide
├── PROMPT.md                    ← copy-paste prompt for an AI assistant
├── LICENSE                      ← MIT
├── css/
│   ├── tokens.css               ← :root colour & font tokens (replaceable seed)
│   └── styles/<style>.css       ← visual style sheet (Flat | Gradient | Volume | Glow)
├── js/
│   ├── palette_tools.js         ← createPalette() engine, pure functions
│   ├── palettes.js              ← 15 palette seeds + localised names
│   ├── tokens.js                ← reads CSS vars into a JS COLORS object
│   ├── gen_colors.js            ← OKLCH helpers (used by ColorPicker)
│   ├── i18n.js                  ← loadLanguage(), t(), data-i18n bindings
│   └── controls/
│       ├── flat.js              ← all generic Web Components (buttons, sliders, …)
│       ├── rotary-knob.js       ← canvas rotary knob
│       └── gauges.js            ← canvas circular & linear gauges
└── i18n/
    ├── en.json …                ← language packs (en, es, fr, de, it, ru, ja, ko, zh)
```

You can place these wherever you like; the only requirement is that each
JS module's relative imports stay intact (`controls/foo.js` imports
`../tokens.js`, etc.).

---

## 2. Quick start

### 2.1 Load the CSS

```html
<link rel="stylesheet" href="css/tokens.css" />
<link rel="stylesheet" href="css/styles/<style>.css" />  <!-- one of: flat | gradient | volume | glow -->
```

### 2.2 Load the JS as ES modules

```html
<script type="module" src="js/controls/flat.js"></script>
<script type="module" src="js/controls/rotary-knob.js"></script>
<script type="module" src="js/controls/gauges.js"></script>
<script type="module" src="js/app.js"></script>
```

> All four CSS styles share the same JS modules — `flat.js` defines every
> generic Web Component; `<style>.css` decides how it looks.

### 2.3 Set the theme

```html
<html data-theme="dark">  <!-- or "light" -->
```

### 2.4 Use the components

```html
<push-button label="Save"></push-button>
<toggle-switch label="WiFi"></toggle-switch>
<segmented-control values='["A","B","C"]' value="A" columns="3"></segmented-control>
<rotary-knob mode="continuous" min="0" max="100" value="50" label="Volume"></rotary-knob>
<circular-gauge value="60" min="0" max="100" label="Speed"></circular-gauge>
<linear-gauge value="45" min="0" max="100" direction="horizontal" label="Level"></linear-gauge>
<bar-chart title="Revenue" data="[[40,60,80,50]]" labels='["Q1","Q2","Q3","Q4"]'></bar-chart>
```

That's all you need to get a working, themed UI. The remainder of this
document explains how to plug the palette engine in so users can pick a
palette / theme / language at runtime.

---

## 3. How the pieces fit together

```
┌──────────────────┐    createPalette()    ┌──────────────────┐
│ palettes.js      │ ───────────────────▶  │ palette_tools.js │
│  (seed colours)  │                       │  (engine)        │
└──────────────────┘                       └────────┬─────────┘
                                                    │ variant tokens
                                                    ▼
                                          ┌──────────────────┐
                                          │ applyTokensToCSS │  ←  YOUR CODE
                                          │  (your app.js)   │     (one function)
                                          └────────┬─────────┘
                                                    │ sets --neutral-1…12,
                                                    │ --primary-accent-1…M, etc.
                                                    ▼
                                          ┌──────────────────┐
                                          │ tokens.css       │  + dispatches
                                          │ <style>.css      │  'palette-changed'
                                          │ Web Components   │  (canvas controls
                                          └──────────────────┘   redraw on this)
```

The CSS files in this bundle never reference colour values directly — they
read CSS custom properties (`var(--neutral-3)`, `var(--primary-accent-1)`,
…). Replacing those custom properties is the only mechanism you need to
re-skin the entire UI.

---

## 4. The CSS token scheme

`tokens.css` ships with sane defaults; your app overwrites them at runtime.

### 4.1 Neutrals — `--neutral-1` … `--neutral-12`

A 12-stop ramp. **Same token names work in both themes** because the
ordering is reversed by the engine, not by the consumer:

| Theme  | `--neutral-1`             | `--neutral-12`              |
|--------|---------------------------|-----------------------------|
| Dark   | deepest background        | brightest foreground        |
| Light  | lightest background       | darkest foreground          |

Aliases (computed from the ramp):

| Alias            | Equals                |
|------------------|-----------------------|
| `--bg`           | `--neutral-1`         |
| `--panel-bg`     | `--neutral-2`         |
| `--panel-edge`   | `--neutral-3`         |
| `--edge-1`       | `--neutral-4`         |
| `--edge-2`       | `--neutral-5`         |
| `--fg`           | `--neutral-12`        |

### 4.2 Accent ramps

Two independent 5-stop ramps — `--primary-accent-1` … `--primary-accent-5`
and `--secondary-accent-1` … `--secondary-accent-5`. **Lower index = lighter,
higher index = darker** (this is invariant across themes).

### 4.3 Notifications

`--color-error`, `--color-warning`, `--color-success`, `--color-message`,
`--color-note` — fixed semantic tokens.

### 4.4 Categories

`--category-1` … `--category-7` — distinct hues for chart series, tags,
badges, etc. They form a smooth, looped hue sequence.

### 4.5 Font

`--font-display` — single display font family used by all components.

---

## 5. The palette engine

### 5.1 Public API — `palette_tools.js`

| Export | Signature | Purpose |
|---|---|---|
| `createPalette` | `(opts) → { darkTinted, lightTinted, darkAccented, lightAccented }` | Generate the four variants |
| `paletteToTokens` | `(variant, name) → { [name]: { "--label": "#hex", … } }` | Flatten one variant to a CSS-variable map |
| `exportPaletteJson` | `(allVariants) → object` | Flatten all four variants to JSON |

### 5.2 Public API — `palettes.js`

| Export | Type | Purpose |
|---|---|---|
| `PALETTES` | `object` | Seed data keyed by palette name (`main` hex + `accents` array) |
| `PALETTE_I18N` | `object` | Localised display names per palette per language |
| `PALETTE_ORDER` | `string[]` | Recommended display ordering |
| `DEFAULT_PALETTE` | `string` | `"amber"` |

### 5.3 Variant structure

Every variant has the same shape:

| Key | Content |
|---|---|
| `neutrals` | `N` tokens (default 12) — background → foreground scale |
| `primary` | `M` tokens (default 5) — primary accent ramp (light → dark) |
| `secondary` | `M` tokens — secondary accent ramp (light → dark) |
| `notifications` | `{ error, warning, success, note, message }` |
| `categories` | `L` tokens (default 7) — categorical colours |

Each token is `{ id, label, hex, H, S, L }`. The `label` is exactly the
CSS variable name minus the leading `--`, so writing tokens to CSS is a
one-liner (see §6.2).

### 5.4 Generation parameters

All optional; defaults produce good results.

| Parameter | Default | Description |
|---|---|---|
| `main` | `"#808080"` | Neutral tint seed (hex) |
| `seeds` | `[]` | Accent seed colours (hex) |
| `N` | `12` | Number of neutral steps (5–20) |
| `M` | `5` | Number of accent steps (3–7) |
| `L` | `7` | Number of category colours (3–7) |
| `lmin` / `lmax` | `0.05` / `0.95` | Neutral lightness bounds |
| `accentLight` / `accentDark` | `0.55` / `0.45` | Accent lightness targets |
| `alertL` / `categoryL` | `0.55` / `0.55` | Notification & category lightness |
| `sigmoid` | `3.0` | Neutral distribution curve steepness |
| `mode` | `"linear"` | `"linear"`, `"circle"`, or `"superellipse"` |
| `power` | `1.5` | Superellipse exponent |

---

## 6. Reference integration

A minimal `app.js` that wires palette + theme + language to the bundle.
Adapt the **selector widgets** to your framework — the data flow is what
matters, not the choice of `<select>` vs. segmented control vs. radios.

```js
// ── app.js — Style bundle integration ──────────────────────────────

import { PALETTES, PALETTE_ORDER, DEFAULT_PALETTE, PALETTE_I18N }
  from "./js/palettes.js";
import { createPalette } from "./js/palette_tools.js";
import { loadLanguage } from "./js/i18n.js";

// 6.1 ── State ────────────────────────────────────────────────────
let currentPalette = DEFAULT_PALETTE;   // "amber" by default
let currentTheme   = "dark";            // "dark" | "light"
let currentLang    = "en";              // ISO 639-1

const VARIANT_MAP = { dark: "darkTinted", light: "lightTinted" };

// 6.2 ── Apply tokens to CSS custom properties ────────────────────
function applyTokensToCSS(variant) {
  const root = document.documentElement.style;
  for (const t of variant.neutrals)   root.setProperty(`--${t.label}`, t.hex);
  for (const t of variant.primary)    root.setProperty(`--${t.label}`, t.hex);
  for (const t of variant.secondary)  root.setProperty(`--${t.label}`, t.hex);
  for (const t of variant.categories) root.setProperty(`--${t.label}`, t.hex);
  for (const v of Object.values(variant.notifications))
    root.setProperty(`--${v.label}`, v.hex);

  // Tell canvas-based controls (gauges, knobs, charts) to re-read tokens.
  document.dispatchEvent(new CustomEvent("palette-changed", { detail: variant }));
}

// 6.3 ── Regenerate ───────────────────────────────────────────────
function refreshPalette() {
  const p = PALETTES[currentPalette];
  if (!p) return;
  document.documentElement.dataset.theme = currentTheme;   // dark | light
  const result = createPalette({ main: p.main, seeds: p.accents });
  applyTokensToCSS(result[VARIANT_MAP[currentTheme]]);
}

// 6.4 ── Localised palette name with fallback ─────────────────────
function getPaletteName(key, lang = currentLang) {
  const i = PALETTE_I18N[key]?.gems;
  return i?.[lang] || i?.en || PALETTES[key].gems;
}

// 6.5 ── Build any palette selector you like ──────────────────────
function buildPaletteSelect(selectEl) {
  selectEl.innerHTML = "";
  for (const key of PALETTE_ORDER) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = getPaletteName(key);
    opt.selected = key === currentPalette;
    selectEl.appendChild(opt);
  }
  selectEl.onchange = () => { currentPalette = selectEl.value; refreshPalette(); };
}

// 6.6 ── Theme toggle ─────────────────────────────────────────────
function setTheme(t) { currentTheme = t; refreshPalette(); }

// 6.7 ── Language change ──────────────────────────────────────────
async function setLanguage(lang) {
  currentLang = lang;
  await loadLanguage(lang);             // updates [data-i18n] in the DOM
  buildPaletteSelect(document.getElementById("paletteSelect"));
}

// 6.8 ── Boot ─────────────────────────────────────────────────────
buildPaletteSelect(document.getElementById("paletteSelect"));
refreshPalette();
await loadLanguage(currentLang);
```

### What you must keep

- The token write-out in **§6.2** — every CSS custom property in `tokens.css`
  must be re-set, otherwise some components will fall back to defaults.
- The `palette-changed` event — canvas-based components (gauges, rotary
  knob, charts, color picker) listen for it to re-read tokens and redraw.
- `<html data-theme="dark|light">` — `volume.css`, `gradient.css`,
  `glow.css` switch their gradient-token block on this attribute.

### What you may freely customise

- **Palette / theme / language widgets** — segmented control, dropdown,
  toggle, radio… anything that calls the right setter.
- **Adding more languages** — drop a new JSON file into `i18n/` and add a
  matching block to `PALETTE_I18N` (the engine handles fallback to English).
- **Tuning the palette engine** — pass any of the parameters in §5.4.

---

## 7. Web Components catalogue

All components are vanilla custom elements (no framework). They re-style
themselves automatically on `palette-changed` and on the `data-theme`
attribute.

| Tag | Purpose | Key attributes |
|---|---|---|
| `<push-button>` | Press button | `label`, `disabled`, `accent` (`primary`/`secondary`) |
| `<text-field>` | Single-line input | `value`, `placeholder`, `disabled`, `type` |
| `<check-box>` | Checkbox | `label`, `checked`, `disabled` |
| `<radio-button>` | Radio | `label`, `name`, `value`, `checked` |
| `<toggle-switch>` | On/off switch | `label`, `checked`, `disabled` |
| `<segmented-control>` | Multi-button selector | `values` (JSON array), `value`, `columns`, `data-i18n-values` |
| `<range-slider>` | Horizontal slider | `min`, `max`, `value`, `step`, `label` |
| `<vertical-slider>` | Vertical slider | same as range-slider |
| `<progress-bar>` | Progress indicator | `value`, `min`, `max`, `label` |
| `<rotary-knob>` | Continuous or enum knob | `mode` (`continuous`/`enum`), `min`, `max`, `value`, `values`, `label`, `flat` |
| `<circular-gauge>` | Arc gauge with hand | `min`, `max`, `value`, `label`, `volume` |
| `<linear-gauge>` | Bar gauge | `min`, `max`, `value`, `direction` (`horizontal`/`vertical`), `label`, `volume` |
| `<notification-bar>` | Inline alert | `kind` (`error`/`warning`/…), `message` |
| `<bar-chart>` | Multi-series bars | `title`, `data` (JSON 2-D), `labels` (JSON array) |
| `<line-chart>` | Multi-series lines | `title`, `data`, `labels` |
| `<date-calendar>` | Day-of-week dial | `value` (ISO date) |
| `<color-picker>` | OKLCH chroma picker | `value` (hex), `size` |

### 7.1 Style attributes that components honour

- `flat` — disables gradients/shadows on the rotary knob (used when the
  bundle is paired with `flat.css`).
- `volume` — switches gauges & rotary knob to the recessed-niche track.
- `data-theme="light"` on `<html>` — flips gradient-token block in
  `gradient.css`/`volume.css`/`glow.css`.

### 7.2 Listening to value changes

Every interactive component dispatches an `input` and a `change` event with
`detail.value`. Buttons dispatch `activate`. Example:

```js
document.querySelector("range-slider").addEventListener("input", (e) => {
  console.log("new value:", e.detail.value);
});
document.querySelector("push-button").addEventListener("activate", () => {
  console.log("pressed");
});
```

---

## 8. Filling gaps — components NOT in the bundle

You will sometimes need a UI element that is not shipped. **Do not hand-roll
it from scratch.** Pick the closest match in the bundle and reuse its CSS
custom properties so the new element inherits the visual language.

| Need | Closest match | How to derive |
|---|---|---|
| Dropdown / select | `<text-field>` + `<segmented-control>` | Use `text-field` styling for the trigger; use the segmented-control's per-segment styling for the menu items |
| Tabs | `<segmented-control>` | Set `columns="N"`, treat the active value as the visible tab |
| Accordion / disclosure | `<push-button>` (header) | Use `push-button` for the header, plain `<div>` styled with `--panel-bg` / `--panel-edge` for the body |
| Modal / dialog | `<notification-bar>` (frame) | Frame: `--panel-bg` background + `--panel-edge` border + `var(--shadow-btn, none)` |
| Tooltip | `<notification-bar>` (compact) | Use `--neutral-3` background + `--neutral-12` text |
| Tag / chip | `<push-button>` (small) | Reuse `--btn-bg`/`--btn-border`/`--btn-fg`; force smaller `--btn-padding` |
| Avatar / badge | `<color-picker>` (round shape) | Round container with `--category-N` fill |

**General rule:** every gap-fill component must (a) read CSS custom
properties from `:root`, never literal hex, and (b) react to
`palette-changed` if it draws to a canvas.

---

## 9. Choosing a style flavour

Each `<style>.css` files paints the same components differently:

| Style | Look | When to use |
|---|---|---|
| **Flat** | Solid fills, hairline borders, no gradients or shadows | Information-dense dashboards, accessibility-first apps |
| **Gradient** | Subtle linear gradients on raised surfaces | Default modern look |
| **Volume** | Pseudo-3D gradients with grooves and depth | Audio/instrument UIs, skeuomorphic dashboards |
| **Glow** | Volume + emissive accents (planned) | Same niches as Volume but with hero accents |

Switching is a single `<link>` swap — the components themselves don't change.

---

## 10. Internationalisation

`i18n.js` is a tiny module:

```js
import { loadLanguage, t, getCurrentLang } from "./js/i18n.js";

await loadLanguage("de");          // fetches /i18n/de.json, applies DOM bindings
const label = t("btn.save");       // "Speichern"
```

It walks the DOM and updates these bindings:

| Attribute | Effect |
|---|---|
| `data-i18n` | Sets `textContent` |
| `data-i18n-placeholder` | Sets `placeholder` |
| `data-i18n-label` | Sets `label` (Web Components) |
| `data-i18n-title` | Sets `title` |
| `data-i18n-message` | Sets `message` (notification-bar) |
| `data-i18n-values` | `"k1,k2,…"` → translated JSON array on `values` |

It dispatches a `language-changed` event that you can listen for to
re-render selectors that show palette names, etc.

**Supported languages:** `en`, `es`, `fr`, `de`, `it`, `ru`, `ja`, `ko`, `zh`.

**Adding one:** copy `en.json` to `xx.json`, translate values, add a
`PALETTE_I18N[*][gems][xx]` entry per palette in `palettes.js`. No code
changes are needed; the fallback chain (`xx → en → raw`) handles missing
keys.

---

## 11. FAQ — questions you'll probably hit

**Q: I want to keep my existing colour tokens.**
Don't. Replace them entirely with the ramp-based scheme above (12 neutrals,
2×5 accents, 7 categories, 5 notifications). Patching old token names with
new values forfeits the engine's ramp granularity and makes Dark/Light
flipping unreliable.

**Q: My existing CSS uses `--background` / `--text-primary` / etc.**
Add a thin alias layer in your own stylesheet:
`:root { --background: var(--bg); --text-primary: var(--fg); }` — the
engine still drives the actual values.

**Q: I only need 5 neutrals, not 12.**
Pass `N: 5` to `createPalette()` and write only `--neutral-1` … `--neutral-5`
in your `applyTokensToCSS()`. The shipped CSS will still work because the
unset tokens fall back to the seed values in `tokens.css`.

**Q: Why does the gauge/knob ignore my new colour for a fraction of a second?**
You forgot to dispatch `palette-changed` in `applyTokensToCSS()` (see §6.2).
HTML/CSS components update via the cascade automatically; canvas components
need the event to refresh their JS-side `COLORS` cache.

**Q: How do I disable Tinted/Accented and only expose Tinted?**
Don't expose `darkAccented`/`lightAccented` in the UI. The reference
integration in §6 already does this (`VARIANT_MAP` only maps to `*Tinted`).

**Q: Bundle imports break under my bundler (Webpack/Vite/etc.)**
The modules use plain ES `import "./foo.js"` paths. Either keep them under
the same directory layout or configure your bundler to resolve `.js`
extensions. There are no third-party runtime dependencies.

**Q: Can I use this in React / Vue / Svelte?**
Yes — Web Components are framework-agnostic. Mount them in JSX/templates
as you would any HTML element. Bind their value via the `input`/`change`
events (see §7.2). The palette engine and `applyTokensToCSS()` live in
your top-level effect / store / setup hook.

---

## 12. License

Released under the **MIT License** (see `LICENSE`).

Copyright © 2026 Tim Pyrkov

You are free to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the bundle in your own projects, provided the
copyright notice and permission notice are included.
