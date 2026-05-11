<h1><p align="left">
  <img src="https://github.com/timpyrkov/webappcontrols/blob/master/public/icons/apple-touch-icon.png?raw=true" alt="Web App Colors logo" height="30" style="vertical-align: middle; margin-right: 10px;">
  <span style="font-size:2.5em; vertical-align: middle;"><b>Web App Controls</b></span>
</p></h1>

A showcase and export tool for reusable, palette-driven Web Components.
Preview 17 custom elements — buttons, sliders, knobs, gauges, charts,
calendars, and more — across four visual styles and 15 colour palettes,
then export a ready-to-integrate bundle for your own project.

**Live demo:** https://webappcontrols.vercel.app/

---

## Features

- **15 colour palettes** — Ruby, Gold, Amber, Emerald, Sapphire, … Each palette generates a full token set: 12 neutrals, 2×5 accents, 7 categories, 5 notification colours.
- **4 visual styles** — **Flat** (solid fills), **Gradient** (subtle gradients), **Volume** (pseudo-3D depth), **Glow** (emissive accents). One CSS file swap changes the entire look.
- **Dark / Light themes** — toggle instantly; the palette engine reverses the neutral ramp so token names stay the same in both modes.
- **17 Web Components** — `<push-button>`, `<text-field>`, `<check-box>`, `<radio-button>`, `<toggle-switch>`, `<segmented-control>`, `<range-slider>`, `<vertical-slider>`, `<progress-bar>`, `<rotary-knob>`, `<circular-gauge>`, `<linear-gauge>`, `<notification-bar>`, `<bar-chart>`, `<line-chart>`, `<date-calendar>`, `<color-picker>`.
- **i18n** — 9 languages (EN, ES, FR, DE, IT, RU, JA, KO, ZH). Palette names, component labels, and UI strings are translated via lightweight JSON packs.
- **One-click export** — download a `{Style}_modules.zip` bundle containing the selected style CSS, all JS modules, i18n packs, and integration docs (`STYLES.md`, `PROMPT.md`).

## Bundle contents

The exported zip has everything needed to style a new web project:

| Path | Purpose |
|---|---|
| `css/tokens.css` | CSS custom properties (seed defaults) |
| `css/styles/<style>.css` | Visual style sheet for the selected flavour |
| `js/palette_tools.js` | `createPalette()` engine — pure functions, zero DOM deps |
| `js/palettes.js` | 15 palette seed definitions + localised display names |
| `js/tokens.js` | Reads CSS vars into a JS `COLORS` object for canvas controls |
| `js/gen_colors.js` | OKLCH colour-space helpers (used by `<color-picker>`) |
| `js/i18n.js` | `loadLanguage()`, `t()`, DOM `data-i18n` bindings |
| `js/controls/flat.js` | All generic Web Components |
| `js/controls/rotary-knob.js` | Canvas rotary knob |
| `js/controls/gauges.js` | Canvas circular and linear gauges |
| `i18n/*.json` | Language packs |
| `STYLES.md` | Full integration guide |
| `PROMPT.md` | AI-assistant integration prompt |

## Quick start (local dev)

```bash
npm install
npm start          # http://localhost:3000
```

## Integration

1. Export a style bundle from the live demo (or run locally and click **Export style**).
2. Unzip into your project.
3. Add `<link>` tags for `tokens.css` + `styles/<style>.css`.
4. Add `<script type="module">` for `flat.js`, `rotary-knob.js`, `gauges.js`.
5. Wire the palette engine in your app's entry point — see `STYLES.md` §6 for a copy-paste reference.
6. Use the custom elements directly in your HTML/JSX/templates.

See `STYLES.md` for the full integration guide and `PROMPT.md` for an
AI-assistant prompt that walks through the process step by step.

## Tech stack

- **Vanilla JS** — no framework, no build step
- **Web Components** (Custom Elements v1) — framework-agnostic
- **Canvas 2D** — rotary knobs, gauges, and charts
- **Express** — local dev server + export endpoint
- **Vercel** — production deployment (serverless function for export)

## Notes

- **Disclaimer:** this project was developed with the help of AI tools; the code may contain errors or inaccuracies.
- **Privacy note:** this site stores theme, language, and font preferences in `localStorage`; no tracking cookies are used.
- **Seven Segment** and **Orbitron** fonts only support latin alphabets, are not part of this project and are used for demonstration purposes only.
- The **Agate** palette colors are inspired by the [gruvbox](https://github.com/morhetz/gruvbox) color scheme by Pavel Pertsev.

## License

[MIT](LICENSE) — Copyright © 2026 Tim Pyrkov
