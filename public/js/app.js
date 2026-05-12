/**
 * app.js — Boot script.
 * Wires global controls to the palette engine and preview panel.
 */
import { PALETTES, PALETTE_ORDER, DEFAULT_PALETTE, PALETTE_I18N } from "./palettes.js";
import { createPalette } from "./palette_tools.js";
import { getActiveStyle, switchStyle } from "./style-manager.js";
import { loadLanguage, t } from "./i18n.js";

/* ── State ── */
let currentPalette = DEFAULT_PALETTE;
let currentTheme = "dark";        // "dark" | "light"
let currentResult = null;          // output of createPalette()

// Variant mapping (tinted only — no accented)
const VARIANT_MAP = { dark: "darkTinted", light: "lightTinted" };

// Editable copy of palette seeds (starts as clone of PALETTES)
const editedPalettes = JSON.parse(JSON.stringify(PALETTES));

/* ── Version tag ── */
fetch("/api/version").then(r => { if (!r.ok) throw 0; return r.json(); })
  .catch(() => fetch("/version.json").then(r => r.json()))
  .then(v => {
    const el = document.getElementById("versionTag");
    if (el && v.tag) el.textContent = v.tag + (v.message ? " — " + v.message : "");
  }).catch(() => {});

/* ── Helpers ── */

function _gen() {
  const p = editedPalettes[currentPalette];
  if (!p) return null;
  currentResult = createPalette({ main: p.main, seeds: p.accents });
  return currentResult;
}

/**
 * Map a variant from createPalette() to existing CSS custom properties.
 * Keeps full backward compatibility with all style CSS files and controls.
 */
function applyTokensToCSS(variant) {
  const root = document.documentElement.style;
  const n = variant.neutrals;
  const N = n.length;   // typically 12
  const M = variant.primary.length;

  // Clear stale accent properties (palettes may have 5 or 7 stops)
  for (let i = 1; i <= 9; i++) {
    root.removeProperty(`--primary-accent-${i}`);
    root.removeProperty(`--secondary-accent-${i}`);
  }

  // Backgrounds & foregrounds
  root.setProperty("--bg",         n[0].hex);
  root.setProperty("--panel-bg",   n[Math.min(1, N - 1)].hex);
  root.setProperty("--panel-edge", n[Math.min(2, N - 1)].hex);
  root.setProperty("--edge-1",     n[Math.min(3, N - 1)].hex);
  root.setProperty("--edge-2",     n[Math.min(4, N - 1)].hex);
  root.setProperty("--fg",         n[N - 1].hex);

  // Full neutral ramp 1..12
  for (let i = 0; i < N; i++) {
    root.setProperty(`--neutral-${i + 1}`, n[i].hex);
  }

  // Primary accents
  for (let i = 0; i < M; i++) {
    root.setProperty(`--primary-accent-${i + 1}`, variant.primary[i].hex);
  }

  // Secondary accents
  for (let i = 0; i < variant.secondary.length; i++) {
    root.setProperty(`--secondary-accent-${i + 1}`, variant.secondary[i].hex);
  }

  // Notifications
  for (const [, v] of Object.entries(variant.notifications)) {
    root.setProperty(`--${v.label}`, v.hex);
  }

  // Categories (for bar-chart series etc.)
  if (variant.categories) {
    for (let i = 0; i < variant.categories.length; i++) {
      root.setProperty(`--category-${i + 1}`, variant.categories[i].hex);
    }
  }

  // Extended accents (lighter/darker edges for pseudo-3D effects)
  if (variant.extendedAccents) {
    for (const e of variant.extendedAccents) {
      root.setProperty(`--${e.label}`, e.hex);
    }
  }

  document.dispatchEvent(new CustomEvent("palette-changed", { detail: variant }));
}

/* ── Palette application ── */

function refreshPalette() {
  const result = _gen();
  if (!result) return;
  document.documentElement.dataset.theme = currentTheme;
  const variant = result[VARIANT_MAP[currentTheme]];
  applyTokensToCSS(variant);
}

/* ── Wire palette segmented control ── */

let _currentLang = "en";
const paletteSelect = document.getElementById("paletteSelect");

function _paletteNames(lang) {
  return PALETTE_ORDER.map((key) => {
    const i18n = PALETTE_I18N[key];
    return (i18n && i18n.gems && i18n.gems[lang]) || PALETTES[key].gems;
  });
}

// Mapping: displayed name → palette key (rebuilt on language change)
let _nameToKey = {};
function _rebuildNameToKey(lang) {
  _nameToKey = {};
  PALETTE_ORDER.forEach((key) => {
    const i18n = PALETTE_I18N[key];
    const display = (i18n && i18n.gems && i18n.gems[lang]) || PALETTES[key].gems;
    _nameToKey[display] = key;
  });
}

function _initPaletteSelect(lang) {
  if (!paletteSelect) return;
  _rebuildNameToKey(lang);
  const names = _paletteNames(lang);
  paletteSelect.setAttribute("keys", JSON.stringify(PALETTE_ORDER));
  paletteSelect.setAttribute("values", JSON.stringify(names));
  paletteSelect.setAttribute("value", currentPalette);
}

_initPaletteSelect(_currentLang);

if (paletteSelect) {
  paletteSelect.addEventListener("change", (e) => {
    const key = e.detail?.value;  // stable key from keys attr
    if (key && key !== currentPalette && PALETTES[key]) {
      currentPalette = key;
      refreshPalette();
      buildPickers();
      updateMetaFromPalette();
    }
  });
}

/* ── Wire language toggle ── */

const langSelect = document.getElementById("langSelect");
const _langMap = { en: "en", es: "es", it: "it", fr: "fr", de: "de", ru: "ru", ko: "ko", ja: "ja", zh: "zh" };
if (langSelect) {
  langSelect.addEventListener("change", (e) => {
    const raw = (e.detail?.value || "EN").toLowerCase();
    const lang = _langMap[raw] || raw;
    _currentLang = lang;
    loadLanguage(lang);
    _initPaletteSelect(lang);
    updateMetaFromPalette();
    _applyFont();
  });
}

/* ── Wire theme toggle ── */

const themeSelect = document.getElementById("themeSelect");
if (themeSelect) {
  themeSelect.addEventListener("change", (e) => {
    const key = (e.detail?.value || "Dark");
    currentTheme = key.toLowerCase();
    refreshPalette();
  });
}

/* ── Wire font toggle ── */

let _currentFont = "System";
const _fontMap = {
  "Orbitron":  "'Orbitron', system-ui, sans-serif",
  "Digital-7": "'Seven Segment', monospace",
  "System":    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const _nonLatinLangs = new Set(["ru", "ko", "ja", "zh"]);

function _applyFont() {
  const useSystem = _nonLatinLangs.has(_currentLang) && _currentFont !== "System";
  const value = useSystem ? _fontMap["System"] : (_fontMap[_currentFont] || _fontMap["System"]);
  document.documentElement.style.setProperty("--font-display", value);
  // Trigger canvas-based controls to redraw with new font
  document.dispatchEvent(new CustomEvent("palette-changed"));
}

const fontSelect = document.getElementById("fontSelect");
if (fontSelect) {
  fontSelect.addEventListener("change", (e) => {
    _currentFont = e.detail?.value || "System";  // key from keys attr
    _applyFont();
  });
}

/* ── Wire style toggle ── */

const styleSelect = document.getElementById("styleSelect");
let _currentStyleKey = "Flat";
function _updateTitleGradient() {
  const el = document.querySelector(".accent-title");
  if (!el) return;
  // Gradient text for styles other than Flat
  if (_currentStyleKey !== "Flat") {
    el.classList.add("gradient");
  } else {
    el.classList.remove("gradient");
  }
}
_updateTitleGradient();
// Set initial flat state on canvas-based components
document.querySelectorAll("rotary-knob, circular-gauge, bar-chart, line-chart").forEach((el) => el.setAttribute("flat", ""));

if (styleSelect) {
  const styleNameMap = { Glow: "glow", Flat: "flat", Gradient: "gradient", Volume: "volume" };
  styleSelect.addEventListener("change", (e) => {
    const key = e.detail?.value || "Flat";  // stable key from keys attr
    _currentStyleKey = key;
    switchStyle(styleNameMap[key] || key.toLowerCase());
    _updateTitleGradient();
    // Toggle flat attribute on canvas-based components
    document.querySelectorAll("rotary-knob, circular-gauge, bar-chart, line-chart").forEach((el) => {
      if (key === "Flat") el.setAttribute("flat", "");
      else el.removeAttribute("flat");
    });
    document.querySelectorAll("circular-gauge, linear-gauge, rotary-knob").forEach((el) => {
      if (key === "Volume" || key === "Glow") el.setAttribute("volume", "");
      else el.removeAttribute("volume");
    });
    document.querySelectorAll("rotary-knob, circular-gauge, linear-gauge, bar-chart, line-chart").forEach((el) => {
      if (key === "Glow") el.setAttribute("glow", "");
      else el.removeAttribute("glow");
    });
  });
}

/* ── Wire showcase buttons (right panel, purely visual) ── */

function _wirePlayPause(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("activate", () => {
    const isPressed = btn.hasAttribute("pressed");
    if (isPressed) {
      btn.removeAttribute("pressed");
      btn.setAttribute("label", t("btn.play"));
      btn.dataset.i18nLabel = "btn.play";
    } else {
      btn.setAttribute("pressed", "");
      btn.setAttribute("label", t("btn.pause"));
      btn.dataset.i18nLabel = "btn.pause";
    }
  });
}
_wirePlayPause("btnPlayPrimary");
_wirePlayPause("btnPlaySecondary");

// Globe toggle
const btnGlobe = document.getElementById("btnGlobe");
if (btnGlobe) {
  btnGlobe.addEventListener("activate", () => {
    if (btnGlobe.hasAttribute("pressed")) btnGlobe.removeAttribute("pressed");
    else btnGlobe.setAttribute("pressed", "");
  });
}

// Location toggle
const btnLoc = document.getElementById("btnLocation");
if (btnLoc) {
  btnLoc.addEventListener("activate", () => {
    if (btnLoc.hasAttribute("pressed")) btnLoc.removeAttribute("pressed");
    else btnLoc.setAttribute("pressed", "");
  });
}

/* ── Wire disable-all ── */

const disableBox = document.getElementById("disableAll");
if (disableBox) {
  disableBox.addEventListener("change", () => {
    const right = document.querySelector(".panel-right");
    if (!right) return;
    const controls = right.querySelectorAll(
      "rotary-knob, push-button, segmented-control, toggle-switch, " +
      "check-box, radio-button, text-field, range-slider, vertical-slider, " +
      "date-calendar, notification-bar"
    );
    controls.forEach((el) => {
      if (el.hasAttribute("data-permanent-disabled")) return;
      if (disableBox.checked) el.setAttribute("disabled", "");
      else el.removeAttribute("disabled");
    });
  });
}

/* ── Wire niche-shadows toggle ── */

const nicheBox = document.getElementById("nicheToggle");
if (nicheBox) {
  nicheBox.addEventListener("change", () => {
    document.dispatchEvent(new CustomEvent("niche-toggled", {
      detail: { enabled: nicheBox.checked }
    }));
  });
}

/* ── Dynamic colour pickers ── */

const pickerContainer = document.getElementById("pickerContainer");

/**
 * Build colour picker columns dynamically.
 * 1 picker for "main" + 1 per accent colour.
 * Calculates picker size based on how many columns fit the panel width.
 */
function buildPickers() {
  if (!pickerContainer) return;
  const p = editedPalettes[currentPalette];
  if (!p) return;

  const count = 1 + p.accents.length;  // main + accents
  // Show up to 4 per row; excess wraps. Size between 80–140px.
  const perRow = Math.min(count, 4);
  const maxSize = Math.min(140, Math.floor((488 - (perRow - 1) * 12) / perRow));
  const size = Math.max(80, maxSize);

  pickerContainer.innerHTML = "";

  // Helper: create one picker column
  function _col(label, hex, onChange) {
    const col = document.createElement("div");
    col.className = "picker-col";
    const picker = document.createElement("color-picker");
    picker.setAttribute("size", String(size));
    picker.setAttribute("no-input", "");
    picker.setAttribute("value", hex);
    col.appendChild(picker);

    const row = document.createElement("div");
    row.className = "picker-label-row";
    const lbl = document.createElement("span");
    lbl.className = "swatch-label";
    lbl.textContent = label;
    const swatch = document.createElement("div");
    swatch.className = "swatch-preview";
    swatch.style.background = hex;
    const hexInput = document.createElement("input");
    hexInput.className = "hex-input";
    hexInput.type = "text";
    hexInput.maxLength = 7;
    hexInput.value = hex;
    row.appendChild(lbl);
    row.appendChild(swatch);
    row.appendChild(hexInput);
    col.appendChild(row);

    picker.addEventListener("change", (e) => {
      const v = e.detail?.value;
      if (v) { hexInput.value = v; swatch.style.background = v; onChange(v); }
    });
    hexInput.addEventListener("change", () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        picker.setAttribute("value", v);
        swatch.style.background = v;
        onChange(v);
      }
    });

    return { col, picker, hexInput };
  }

  const mainCol = _col("Main", p.main, (hex) => { p.main = hex; refreshPalette(); });
  pickerContainer.appendChild(mainCol.col);

  p.accents.forEach((accHex, i) => {
    const label = p.accents.length <= 2
      ? (i === 0 ? "Acc1" : "Acc2")
      : `Acc${i + 1}`;
    const accCol = _col(label, accHex, (hex) => {
      p.accents[i] = hex;
      refreshPalette();
    });
    pickerContainer.appendChild(accCol.col);
  });
}

function updatePickerFromPalette() {
  buildPickers();
}

function updateMetaFromPalette() {
  const p = editedPalettes[currentPalette];
  if (!p) return;
  const i18n = PALETTE_I18N[currentPalette];
  const lang = _currentLang;
  const g = document.getElementById("metaGems");
  const n = document.getElementById("metaNatural");
  const f = document.getElementById("metaFlower");
  const b = document.getElementById("metaBeverage");
  if (g) g.value = (i18n && i18n.gems && i18n.gems[lang]) || p.gems || "";
  if (n) n.value = (i18n && i18n.natural && i18n.natural[lang]) || p.natural || "";
  if (f) f.value = (i18n && i18n.flower && i18n.flower[lang]) || p.flower || "";
  if (b) b.value = (i18n && i18n.beverage && i18n.beverage[lang]) || p.beverage || "";
}

/* ── Wire Save / Reset ── */

const btnSave = document.getElementById("btnSavePalette");
const btnReset = document.getElementById("btnResetPalette");

if (btnSave) {
  btnSave.addEventListener("activate", () => {
    const p = editedPalettes[currentPalette];
    const g = document.getElementById("metaGems");
    const n = document.getElementById("metaNatural");
    const f = document.getElementById("metaFlower");
    const b = document.getElementById("metaBeverage");
    if (g) p.gems = g.value;
    if (n) p.natural = n.value;
    if (f) p.flower = f.value;
    if (b) p.beverage = b.value;
    _initPaletteSelect(_currentLang);
  });
}

if (btnReset) {
  btnReset.addEventListener("activate", () => {
    const orig = PALETTES[currentPalette];
    if (!orig) return;
    editedPalettes[currentPalette] = JSON.parse(JSON.stringify(orig));
    buildPickers();
    updateMetaFromPalette();
    refreshPalette();
    _initPaletteSelect(_currentLang);
  });
}

/* ── Wire Export style ── */

const _styleKeyToFile = { Glow: "glow", Flat: "flat", Gradient: "gradient", Volume: "volume" };
const btnExportStyle = document.getElementById("btnExportStyle");
if (btnExportStyle) {
  btnExportStyle.addEventListener("activate", () => {
    const styleName = _styleKeyToFile[_currentStyleKey] || "flat";
    window.location.href = `/api/export-style?style=${styleName}`;
  });
}

/* ── Wire sliders → gauges for interactive testing ──
   Mapping (all default 0–100, easily changed via min/max attributes):
     vslider1 (Value)    → gaugeTemp (vertical) + gaugeLevel (horizontal)
     vslider2 (Progress) → gaugeSpeed (circular)
     hslider1 (Value)    → gaugeFuel (vertical)
     hslider2 (Progress) → gaugeRPM (circular)
*/
const _sliderGaugeMap = [
  { slider: "vslider1", gauges: ["gaugeTemp"] },
  { slider: "vslider2", gauges: ["gaugeSpeed", "gaugeFuel"] },
  { slider: "hslider1", gauges: ["gaugeLevel"] },
  { slider: "hslider2", gauges: ["gaugeRPM"] },
];

for (const { slider, gauges } of _sliderGaugeMap) {
  const el = document.getElementById(slider);
  if (!el) continue;
  el.addEventListener("input", (e) => {
    const v = e.detail?.value ?? parseFloat(el.getAttribute("value"));
    for (const gId of gauges) {
      const g = document.getElementById(gId);
      if (g && g.setValue) g.setValue(v);
    }
  });
}

/* ── Info note toggle ── */
const infoToggle = document.getElementById("infoNoteToggle");
const infoText = document.getElementById("infoNoteText");
if (infoToggle && infoText) {
  infoToggle.checked = false;
  infoText.classList.remove("open");
  infoToggle.addEventListener("change", () => {
    infoText.classList.toggle("open", infoToggle.checked);
  });
}

/* ── Initial render ── */
refreshPalette();
updatePickerFromPalette();
updateMetaFromPalette();
await loadLanguage("en");
