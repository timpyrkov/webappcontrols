/**
 * tokens.js — Palette as JS constants for canvas-based controls.
 *
 * Reads current CSS custom properties from :root. Falls back to static
 * defaults (Amber, dark theme) when CSS is not yet applied.
 */

function get(prop, fallback) {
  if (typeof document === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  return val || fallback;
}

export const COLORS = {
  bg:       get("--bg",               "#181610"),
  fg:       get("--fg",               "#e8e4d8"),
  neutral1: get("--neutral-1",        "#302c25"),
  neutral2: get("--neutral-2",        "#58523e"),
  accent1:  get("--primary-accent-1", "#d08028"),
  accent2:  get("--primary-accent-5", "#f0c030"),
};

/** Re-read CSS custom properties. Call after palette-changed event. */
export function refreshColors() {
  COLORS.bg       = get("--bg",               COLORS.bg);
  COLORS.fg       = get("--fg",               COLORS.fg);
  COLORS.neutral1 = get("--neutral-1",        COLORS.neutral1);
  COLORS.neutral2 = get("--neutral-2",        COLORS.neutral2);
  COLORS.accent1  = get("--primary-accent-1", COLORS.accent1);
  COLORS.accent2  = get("--primary-accent-5", COLORS.accent2);
}
