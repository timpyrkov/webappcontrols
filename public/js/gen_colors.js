/**
 * gen_colors.js — OKLCh-based palette generator.
 *
 * Takes a `main` hex colour + `accents[]` array and produces full CSS token
 * sets for Dark and Light themes in both saturation modes.
 */

/* ================================================================
   Colour-space conversions: hex ↔ sRGB ↔ linear-RGB ↔ OKLab ↔ OKLCh
   ================================================================ */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

function rgbToHex([r, g, b]) {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const toHex = (v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function delinearize(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbToLinear([r, g, b]) {
  return [linearize(r), linearize(g), linearize(b)];
}

function linearToRgb([r, g, b]) {
  return [delinearize(r), delinearize(g), delinearize(b)];
}

function linearRgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function oklabToLinearRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function oklabToOklch([L, a, b]) {
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return [L, C, h];
}

function oklchToOklab([L, C, h]) {
  const rad = h * (Math.PI / 180);
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/* ── Convenience pipelines ── */

export function hexToOklch(hex) {
  return oklabToOklch(linearRgbToOklab(rgbToLinear(hexToRgb(hex))));
}

export function oklchToHex([L, C, h]) {
  return rgbToHex(linearToRgb(oklabToLinearRgb(oklchToOklab([L, C, h]))));
}

/* ================================================================
   Interpolation helpers
   ================================================================ */

function lerpOklch(a, b, t) {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    ((a[2] + dh * t) % 360 + 360) % 360,
  ];
}

/**
 * Interpolate an array of OKLCh stops to `count` evenly-spaced values.
 * Supports 2, 3, or any number of input stops.
 */
function interpolateStops(oklchStops, count) {
  if (oklchStops.length >= count) return oklchStops.slice(0, count);
  if (oklchStops.length === 1) return Array(count).fill(oklchStops[0]);

  const result = [];
  const segments = oklchStops.length - 1;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const segPos = t * segments;
    const segIdx = Math.min(Math.floor(segPos), segments - 1);
    const localT = segPos - segIdx;
    result.push(lerpOklch(oklchStops[segIdx], oklchStops[segIdx + 1], localT));
  }
  return result;
}

/* ================================================================
   Token generation
   ================================================================ */

/**
 * Generate primary accent tokens from accents array.
 * - 2 or 3 seeds → interpolate to 5 stops.
 * - 5+ seeds → use as-is.
 */
function generatePrimaryAccents(accents) {
  const oklchSeeds = accents.map(hexToOklch);
  const targetCount = accents.length >= 5 ? accents.length : 5;
  const stops = interpolateStops(oklchSeeds, targetCount);
  return stops.map(oklchToHex);
}

/**
 * Generate secondary accents from `main` with lightness shifts.
 */
function generateSecondaryAccents(mainOklch) {
  const [L, C, h] = mainOklch;
  const shifts = [-0.20, -0.10, 0, 0.10, 0.20];
  return shifts.map((dL) => {
    const newL = Math.max(0, Math.min(1, L + dL));
    return oklchToHex([newL, C, h]);
  });
}

/**
 * Generate background, foreground, neutral, panel, and edge tokens
 * for a single theme (dark or light).
 */
function generateBaseTokens(mainOklch, theme, saturationMode) {
  const [, C, h] = mainOklch;
  const chroma = saturationMode === "whole-layout" ? C : 0;

  const bgL    = theme === "dark" ? 0.10 : 0.95;
  const fgL    = theme === "dark" ? 0.90 : 0.15;
  const panelL = theme === "dark" ? 0.13 : 0.92;
  const edgeL  = theme === "dark" ? 0.18 : 0.85;

  const bg       = oklchToHex([bgL, chroma, h]);
  const fg       = oklchToHex([fgL, chroma, h]);
  const panelBg  = oklchToHex([panelL, chroma, h]);
  const panelEdge= oklchToHex([edgeL, chroma * 0.6, h]);
  const edge1    = oklchToHex([edgeL, chroma * 0.4, h]);
  const edge2    = oklchToHex([edgeL + 0.05, chroma * 0.3, h]);

  // Neutrals: evenly spaced between bg and fg
  const neutrals = [];
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const nL = bgL + (fgL - bgL) * t;
    neutrals.push(oklchToHex([nL, chroma * 0.5, h]));
  }

  return { bg, fg, panelBg, panelEdge, edge1, edge2, neutrals };
}

/* ================================================================
   Public API
   ================================================================ */

/**
 * Generate a full palette token map from seed colours.
 *
 * @param {string}   main           - Hex colour for backgrounds/neutrals hue.
 * @param {string[]} accents        - 2, 3, or 5+ hex accent seed colours.
 * @param {object}   options
 * @param {string}   options.saturationMode - 'accents-only' | 'whole-layout'
 * @param {object|null} options.special     - Override rules or null.
 * @returns {{ dark: Object<string,string>, light: Object<string,string> }}
 */
export function generatePalette(main, accents, {
  saturationMode = "accents-only",
  special = null,
} = {}) {
  const mainOklch = hexToOklch(main);

  // Primary accents (same for both themes)
  const primaryHexes = generatePrimaryAccents(accents);

  // Secondary accents (same for both themes)
  const secondaryHexes = generateSecondaryAccents(mainOklch);

  const result = {};

  for (const theme of ["dark", "light"]) {
    const base = generateBaseTokens(mainOklch, theme, saturationMode);
    const tokens = {};

    tokens["--bg"] = base.bg;
    tokens["--fg"] = base.fg;
    tokens["--panel-bg"] = base.panelBg;
    tokens["--panel-edge"] = base.panelEdge;
    tokens["--edge-1"] = base.edge1;
    tokens["--edge-2"] = base.edge2;

    for (let i = 0; i < base.neutrals.length; i++) {
      tokens[`--neutral-${i + 1}`] = base.neutrals[i];
    }

    for (let i = 0; i < primaryHexes.length; i++) {
      tokens[`--primary-accent-${i + 1}`] = primaryHexes[i];
    }

    for (let i = 0; i < secondaryHexes.length; i++) {
      tokens[`--secondary-accent-${i + 1}`] = secondaryHexes[i];
    }

    // Semantic notification colours — calm, theme-aware
    tokens["--color-note"]    = theme === "dark" ? "#5bbcb8" : "#3a8a88";
    tokens["--color-message"] = theme === "dark" ? "#4da6e8" : "#2d7abc";
    tokens["--color-success"] = theme === "dark" ? "#5cb85c" : "#3a8a3a";
    tokens["--color-warning"] = theme === "dark" ? "#e8a838" : "#c08020";
    tokens["--color-error"]   = theme === "dark" ? "#d9534f" : "#b83230";

    result[theme] = tokens;
  }

  return result;
}

/**
 * Apply a token map to :root as CSS custom properties.
 * Also dispatches a 'palette-changed' event for canvas-based controls.
 *
 * @param {Object<string,string>} tokens - Token map for one theme.
 */
export function applyPalette(tokens) {
  const root = document.documentElement;
  // Clear stale accent properties (palettes may have 5 or 7 stops)
  for (let i = 1; i <= 9; i++) {
    root.style.removeProperty(`--primary-accent-${i}`);
    root.style.removeProperty(`--secondary-accent-${i}`);
  }
  for (const [prop, value] of Object.entries(tokens)) {
    root.style.setProperty(prop, value);
  }
  document.dispatchEvent(new CustomEvent("palette-changed", { detail: tokens }));
}
