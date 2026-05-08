/**
 * style-manager.js — Manages active style CSS sheet.
 *
 * All styles share the same Web Component JS (flat.js). Visual differences
 * come from different CSS custom-property values set in each style CSS file.
 * Switching styles = swapping the CSS <link> href (no reload needed).
 *
 * Supported styles: flat, basic, gradient, volume
 */

const VALID_STYLES = ["flat", "volume", "basic", "gradient"];
const DEFAULT_STYLE = "flat";

let _active = DEFAULT_STYLE;

/**
 * Get the currently active style name.
 * @returns {string}
 */
export function getActiveStyle() {
  return _active;
}

/**
 * Switch to a new style by swapping the CSS link href.
 * @param {string} styleName
 */
export function switchStyle(styleName) {
  if (!VALID_STYLES.includes(styleName) || styleName === _active) return;
  _active = styleName;
  const link = document.querySelector('link[href*="css/styles/"]');
  if (link) link.href = `css/styles/${styleName}.css`;
}
