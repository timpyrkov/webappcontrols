Please integrate this Web App Controls **style bundle** into the existing web application project. The bundle (`{Style}_modules.zip`) ships a colour palette engine, a CSS token scheme, a single visual style sheet, and a catalogue of themed Web Components. Think step by step and implement each step carefully. Use `STYLES.md` as the authoritative reference for APIs, file layout, and component contracts.

> **IMPORTANT — Full visual layer replacement.**
> Do NOT cherry-pick a few colours or import a single component. You MUST **completely replace** the existing colour-token scheme and styling layer with the bundled one. The full token ramp (12 neutrals, 2×5 accents, 5 notifications, 7 categories) must be available and used. Existing components that overlap with the bundle's catalogue must be replaced or visually subsumed by the bundled equivalents.

---

### Step 1 — Review the existing codebase

Identify, before changing anything:
- The UI framework (React, Vue, Svelte, plain DOM, …) and how custom elements / Web Components are mounted in it.
- Where theme / palette / language state lives (context, store, local state, hooks).
- Existing CSS variable names and token aliases — **these will be replaced or aliased to the new ramp.**
- The full inventory of UI primitives currently in use (buttons, inputs, sliders, dialogs, tabs, …). Mark which of them have a direct match in the bundle's catalogue (Step 6 of `STYLES.md`).

### Step 2 — Drop the bundle into the project

- Copy the `css/`, `js/`, and `i18n/` directories from the unzipped bundle into the project, preserving the relative paths between modules (`controls/foo.js` imports `../tokens.js`, etc.).
- Add the two `<link>` tags (`tokens.css` + `styles/<style>.css`) and the three `<script type="module">` tags (`flat.js`, `rotary-knob.js`, `gauges.js`) at the appropriate place in the host page. If the host uses a bundler, import them from the entry module instead.
- Set `<html data-theme="dark">` (or `"light"`) on the root element.

### Step 3 — Add a palette selector

Pick **whatever widget shape suits the host UI**: dropdown, segmented control, radio group, command-palette item, etc. The widget must:
- List all 15 keys from `PALETTE_ORDER`.
- Display **gemstone names only** (ignore the `natural`, `flower`, `beverage` name categories).
- Use `PALETTE_I18N[key].gems[currentLang]` for the label, with fallback chain `currentLang → en → raw`.
- Default to `DEFAULT_PALETTE` (`"amber"`).
- On change, update state and call the palette refresh function (Step 6).

### Step 4 — Add a Dark/Light theme toggle

Pick whatever shape suits the host (toggle switch, two-button segmented, sun/moon icon, …):
- Sets `document.documentElement.dataset.theme = "dark" | "light"`.
- Maps to `darkTinted` / `lightTinted` variants only — **do not expose Accented**.
- Persists user preference (localStorage or host's settings store).

### Step 5 — Wire i18n

- Call `loadLanguage(code)` on app boot and on every language change.
- Add `data-i18n`, `data-i18n-label`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-message`, `data-i18n-values` attributes to host-app DOM nodes that need translation.
- Listen to the `language-changed` event to re-render any selector that shows palette gemstone names.
- Supported languages: `en`, `es`, `fr`, `de`, `it`, `ru`, `ja`, `ko`, `zh`. To add another, drop a `xx.json` file into `i18n/` and an `xx` entry per palette in `PALETTE_I18N`.

### Step 6 — Replace the entire colour token scheme

**Replace all existing colour tokens** with the bundle's token set. Do not patch old tokens with new hex values — write a new complete token layer.

#### 6.1 Neutrals — `--neutral-1` … `--neutral-12`

Same names work in both themes; the engine reverses the ordering, not the consumer:

| Theme  | `--neutral-1`         | `--neutral-12`              |
|--------|-----------------------|-----------------------------|
| Dark   | deepest background    | brightest foreground        |
| Light  | lightest background   | darkest foreground          |

Usage mapping (theme-agnostic):

| Range | Usage |
|---|---|
| `--neutral-1` | Page / app background |
| `--neutral-2` – `--neutral-3` | Cards / panels / raised surfaces |
| `--neutral-4` – `--neutral-5` | Borders, dividers, subtle separators |
| `--neutral-6` – `--neutral-7` | Disabled states, placeholders |
| `--neutral-8` – `--neutral-9` | Muted / secondary text |
| `--neutral-10` – `--neutral-11` | Body text |
| `--neutral-12` | Primary foreground / headings |

Aliases that the bundled CSS already defines: `--bg`, `--panel-bg`, `--panel-edge`, `--edge-1`, `--edge-2`, `--fg`. Use these in host CSS rather than re-deriving them.

#### 6.2 Accents — `--primary-accent-1…5`, `--secondary-accent-1…5`

Two independent ramps. **Lower index = lighter, higher index = darker.** Invariant across themes.

Typical usage:
- Active / selected control — gradient `accent-1` → `accent-5`.
- Focus ring — `accent-1`.
- Links / interactive text — `accent-1` (Dark) or `accent-5` (Light).
- Secondary actions — `secondary-*`.

#### 6.3 Categories — `--category-1` … `--category-7`

Enumerated, visually distinct hues for chart series, tags, badges, legend items.

#### 6.4 Notifications

Fixed semantic tokens: `--color-error`, `--color-warning`, `--color-success`, `--color-message`, `--color-note`.

#### 6.5 The required write-out

In the host's palette-refresh function (call it `applyTokensToCSS(variant)`):

```js
const root = document.documentElement.style;
for (const t of variant.neutrals)   root.setProperty(`--${t.label}`, t.hex);
for (const t of variant.primary)    root.setProperty(`--${t.label}`, t.hex);
for (const t of variant.secondary)  root.setProperty(`--${t.label}`, t.hex);
for (const t of variant.categories) root.setProperty(`--${t.label}`, t.hex);
for (const v of Object.values(variant.notifications))
  root.setProperty(`--${v.label}`, v.hex);
document.dispatchEvent(new CustomEvent("palette-changed", { detail: variant }));
```

The `palette-changed` event is **mandatory** — canvas-based components (gauges, rotary knobs, charts, color picker) listen for it to refresh their JS-side colour cache. Without it they will appear to "freeze" on the old palette.

### Step 7 — Replace existing UI primitives with bundled ones

For every host primitive that has a direct counterpart in the bundle (button, input, checkbox, radio, switch, slider, progress, tabs ≈ segmented-control, gauges, charts, calendar, color-picker), replace the host implementation with the bundled custom element. Bind to its events:

- `activate` — push-button.
- `input` / `change` with `e.detail.value` — every other interactive control.

Web Components are framework-agnostic; mount them as plain HTML elements inside JSX / templates / DOM as needed.

### Step 8 — Fill the gaps for missing primitives

Some host primitives have **no direct match** in the bundle (dropdown, modal, tooltip, accordion, tabs with content panes, breadcrumbs, …). Do **not** hand-roll a new look for them — derive their styling from the closest match in `STYLES.md` §8:

| Need | Closest match | Derive |
|---|---|---|
| Dropdown / select | `<text-field>` + `<segmented-control>` | Trigger like a text field; menu items like segmented buttons |
| Tabs (with panes) | `<segmented-control>` | Use it as the tab strip; content pane uses `--panel-bg` + `--panel-edge` |
| Accordion | `<push-button>` | Header is a push-button; body is `--panel-bg` |
| Modal / dialog | `<notification-bar>` (frame) | `--panel-bg` + `--panel-edge` + optional `--shadow-btn` |
| Tooltip | `<notification-bar>` (compact) | `--neutral-3` bg + `--neutral-12` text |
| Tag / chip | `<push-button>` (small) | Reuse `--btn-bg/border/fg`; smaller `--btn-padding` |
| Avatar / badge | `<color-picker>` (round) | Round container with `--category-N` fill |

**Strict rules for gap-fill components:**
- Read CSS custom properties from `:root` — never embed literal hex values.
- React to the `palette-changed` event if you draw to a canvas.
- Honour `<html data-theme="…">` automatically by relying on the cascading tokens.

### Step 9 — Use explicit `createPalette()` parameter defaults

| Parameter | Default | Notes |
|-----------|---------|-------|
| `N`         | `12`    | Neutral steps |
| `M`         | `5`     | Accent steps  |
| `L`         | `7`     | Category steps |
| `lmin`      | `0.05`  | Min neutral lightness |
| `lmax`      | `0.95`  | Max neutral lightness |
| `power`     | `1.5`   | Superellipse exponent |
| `sigmoid`   | `3.0`   | Neutral curve steepness |
| `accentLight` | `0.55` | Lighter accent target |
| `accentDark`  | `0.45` | Darker accent target |
| `alertL`    | `0.55`  | Notification lightness |
| `categoryL` | `0.55`  | Category lightness |
| `mode`      | `"linear"` | Arc interpolation |

If the host needs fewer neutrals (say, 5), pass `N: 5` and adjust `applyTokensToCSS()` accordingly — the unset higher tokens will fall back to seed values in `tokens.css`.

### Step 10 — Verify

After integration the following should all be true:

1. Switching the palette selector immediately re-skins **every** UI element — not just the bundled ones.
2. Toggling Dark/Light flips backgrounds, text, and gradients without any visible "theme leak" (regions stuck on the old theme).
3. Switching language updates **both** the bundle's `data-i18n`-bound strings and the palette selector's localised gemstone names.
4. Canvas-based components (gauges, knobs, charts) refresh on every palette change — no need to reload the page.
5. There are no leftover hex literals in host CSS for primary content surfaces; everything routes through the new tokens.

---

In case of questions or uncertainties, ask for clarification. If anything in this prompt conflicts with `STYLES.md`, **follow this prompt**.