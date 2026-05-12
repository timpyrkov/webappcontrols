/**
 * flat.js — All Web Components in Flat style.
 *
 * Flat design: solid colour fills, subtle borders, no gradients or shadows.
 * Each component reads CSS custom properties from :root for theming.
 */

import { COLORS, refreshColors } from "../tokens.js";
import { hexToOklch, oklchToHex } from "../gen_colors.js";

/* ── Helper: read a CSS custom property ── */
function css(prop) {
  return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
}

/* ── Helper: scale bevel padding to an element's actual height ──
 * Two-point linear interpolation between (hiH, hiPad) and (loH, loPad),
 * clamped to a minimum floor.
 *
 * Defaults (edit here to tune all components at once):
 *   HI_H  = 40 px   HI_PAD = 3 px   (large button → 3 px bevel)
 *   LO_H  = 10 px   LO_PAD = 1 px   (small button → 1 px bevel)
 *   MIN   =  1 px                     (absolute floor)
 *
 * Any default can be overridden per-component via CSS custom properties:
 *   --{prefix}-ref-height, --{prefix}-ref-pad,
 *   --{prefix}-ref-height-lo, --{prefix}-ref-pad-lo, --{prefix}-min
 * where {prefix} = targetVar minus the trailing "-width". */
const BEVEL_HI_H = 40, BEVEL_HI_PAD = 3;
const BEVEL_LO_H = 10, BEVEL_LO_PAD = 1;
const BEVEL_MIN  = 1;

function _scaleBevel(host, measureEl, refHeightVar, refPadVar, targetVar) {
  if (!host || !measureEl) return;
  const h = measureEl.getBoundingClientRect().height;
  if (h <= 0) return;
  const cs = getComputedStyle(host);
  const prefix = targetVar.replace(/-width$/, "");
  const rd = (v, def) => { const n = parseFloat(cs.getPropertyValue(v)); return isFinite(n) ? n : def; };
  const hiH   = rd(refHeightVar, BEVEL_HI_H);
  const hiPad = rd(refPadVar,    BEVEL_HI_PAD);
  const loH   = rd(prefix + "-ref-height-lo", BEVEL_LO_H);
  const loPad = rd(prefix + "-ref-pad-lo",    BEVEL_LO_PAD);
  const floor = rd(prefix + "-min",           BEVEL_MIN);
  const t  = (h - loH) / (hiH - loH);
  const px = loPad + t * (hiPad - loPad);
  host.style.setProperty(targetVar, Math.max(floor, Math.round(px)) + "px");
}

/* ================================================================
   <push-button>  — Flat push button
   ================================================================ */

class PushButton extends HTMLElement {
  static get observedAttributes() { return ["label", "icon", "disabled", "accent", "pressed", "no-hover-edge"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._ro = null;
  }

  connectedCallback()  { this._render(); this._observeSize(); }
  disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
  attributeChangedCallback() {
    if (this.shadowRoot.querySelector(".btn")) { this._render(); this._observeSize(); }
  }

  _observeSize() {
    const btn = this.shadowRoot.querySelector(".btn");
    if (!btn) return;
    if (this._ro) this._ro.disconnect();
    this._ro = new ResizeObserver(() =>
      _scaleBevel(this, btn, "--btn-bevel-ref-height", "--btn-bevel-ref-pad", "--btn-bevel-width")
    );
    this._ro.observe(btn);
  }

  _render() {
    const accent = this.getAttribute("accent"); // "secondary" or null
    const isSecondary = accent === "secondary";
    const noHoverEdge = this.hasAttribute("no-hover-edge");
    const pressed = this.hasAttribute("pressed");
    const icon = this.getAttribute("icon") || "";
    const label = this.getAttribute("label") || "";
    const accentBg = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";
    const hoverEdge = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";
    const content = icon && label ? `${icon} ${label}` : icon || label;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block; user-select: none; -webkit-user-select: none;
          border-radius: var(--btn-radius, 6px);
          box-shadow: var(--btn-shadow, none);
        }
        :host([disabled]) { pointer-events: none; }
        :host([disabled]) .btn {
          opacity: var(--btn-disabled-opacity, 0.38);
          background: var(--btn-disabled-bg, var(--btn-bg, var(--neutral-3)));
          background-origin: var(--btn-bg-origin, border-box);
          color: var(--btn-disabled-fg, var(--btn-fg, var(--fg)));
        }
        :host([disabled]) .btn::before {
          background: var(--btn-disabled-overlay, var(--btn-overlay, none));
        }
        .btn {
          position: relative; isolation: isolate;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          background: var(--btn-bg, var(--neutral-3));
          background-origin: var(--btn-bg-origin, border-box);
          color: var(--btn-fg, var(--fg));
          border: var(--btn-border-width, 1px) solid var(--btn-border, var(--neutral-5));
          border-radius: var(--btn-radius, 6px);
          padding: var(--btn-padding, 10px 24px);
          min-width: var(--btn-min-width, auto);
          font: 14px/1 var(--font-display, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.1s;
          white-space: nowrap;
        }
        .btn:focus-visible { outline: var(--btn-focus-ring, none); outline-offset: var(--btn-focus-ring-offset, 2px); }
        .btn::before {
          content: '';
          position: absolute;
          inset: var(--btn-bevel-width, 0px);
          border-radius: calc(var(--btn-radius, 6px) - var(--btn-bevel-width, 0px));
          background: var(--btn-overlay, none);
          z-index: -1;
          transition: background 0.12s;
          pointer-events: none;
        }
        .btn svg { width: 1em; height: 1em; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .btn:hover:not(.pressed):not(:active) {
          background: var(--btn-hover-bg, var(--neutral-5));
          background-origin: var(--btn-bg-origin, border-box);
          ${noHoverEdge ? "" : `border-color: var(--btn-hover-border, ${hoverEdge});`}
        }
        .btn:hover:not(.pressed):not(:active)::before {
          background: var(--btn-hover-overlay, var(--btn-overlay, none));
        }
        .btn:active, .btn.pressed {
          background: ${isSecondary ? `var(--btn-active-bg-secondary, ${accentBg})` : `var(--btn-active-bg, ${accentBg})`};
          background-origin: var(--btn-bg-origin, border-box);
          color: ${isSecondary ? `var(--btn-active-fg-secondary, var(--btn-active-fg, var(--bg)))` : `var(--btn-active-fg, var(--bg))`};
          border-color: var(--btn-active-border, ${accentBg});
          text-shadow: ${isSecondary ? `var(--btn-active-text-shadow-secondary, var(--btn-active-text-shadow, none))` : `var(--btn-active-text-shadow, none)`};
        }
        .btn:active::before, .btn.pressed::before {
          background: ${isSecondary ? `var(--btn-active-overlay-secondary, var(--btn-overlay, none))` : `var(--btn-active-overlay, var(--btn-overlay, none))`};
        }
        .btn:active { transform: scale(0.97); }
      </style>
      <button class="btn${pressed ? " pressed" : ""}">${content}</button>`;

    this.shadowRoot.querySelector(".btn").addEventListener("pointerup", () => {
      if (!this.hasAttribute("disabled")) {
        this.dispatchEvent(new Event("activate", { bubbles: true }));
      }
    });
  }

  setLabel(t) { this.setAttribute("label", t); }
  getLabel()  { return this.getAttribute("label") || ""; }
}

/* ================================================================
   <text-field>  — Flat text input
   ================================================================ */

class TextField extends HTMLElement {
  static get observedAttributes() { return ["placeholder", "value", "disabled", "caption"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._internalUpdate = false;
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback(name) {
    if (!this.shadowRoot.querySelector(".tf-wrap")) return;
    if (name === "value" && this._internalUpdate) return;
    this._render();
  }

  _render() {
    const caption = this.getAttribute("caption") || "";
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        :host([disabled]) input { opacity: 0.55; pointer-events: none; }
        .tf-wrap { display: flex; flex-direction: column; gap: 4px; }
        .caption {
          font: 11px/1 var(--font-display, system-ui, sans-serif);
          color: var(--fg); opacity: 0.5; text-transform: uppercase; letter-spacing: 0.04em;
        }
        input {
          width: 100%;
          padding: var(--field-padding, 9px 12px);
          background: var(--field-bg, var(--bg));
          color: var(--field-fg, var(--fg));
          border: 1px solid var(--field-border, var(--neutral-5));
          border-radius: var(--field-radius, 6px);
          font: 14px/1.4 var(--font-display, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
          box-shadow: var(--field-shadow, none);
        }
        input:focus { border-color: var(--field-focus-border, var(--primary-accent-3)); }
        input::placeholder { color: var(--neutral-7); }
      </style>
      <div class="tf-wrap">
        ${caption ? `<span class="caption">${caption}</span>` : ""}
        <input
          type="text"
          placeholder="${this.getAttribute("placeholder") || ""}"
          value="${this.getAttribute("value") || ""}"
          ${this.hasAttribute("disabled") ? "disabled" : ""}
        />
      </div>`;

    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("input", () => {
      this._internalUpdate = true;
      this.setAttribute("value", input.value);
      this._internalUpdate = false;
      this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: input.value } }));
    });
  }

  getValue() { return this.shadowRoot.querySelector("input")?.value || ""; }
  setValue(v) {
    this.setAttribute("value", v);
    const input = this.shadowRoot.querySelector("input");
    if (input) input.value = v;
  }
}

/* ================================================================
   <check-box>  — Flat checkbox
   ================================================================ */

class CheckBox extends HTMLElement {
  static get observedAttributes() { return ["checked", "indeterminate", "disabled", "label", "accent"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.shadowRoot.querySelector(".wrap")) this._render(); }

  _render() {
    const checked = this.hasAttribute("checked");
    const indeterminate = this.hasAttribute("indeterminate");
    const label = this.getAttribute("label") || "";
    const active = checked || indeterminate;
    const isSecondary = this.getAttribute("accent") === "secondary";
    const accentVar = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; user-select: none; cursor: pointer; }
        :host([disabled]) { pointer-events: none; }
        :host([disabled]) .box {
          opacity: var(--check-disabled-opacity, 0.38);
          background: var(--check-disabled-bg, var(--check-bg, var(--bg)));
          background-origin: var(--check-bg-origin, border-box);
          border-color: var(--check-disabled-border, var(--check-border, var(--neutral-5)));
        }
        :host([disabled]) .box::before {
          background: var(--check-disabled-overlay, var(--check-overlay, none));
        }
        :host([disabled]) .mark { color: var(--check-disabled-fg, var(--fg)); opacity: 0.5; }
        .wrap { display: flex; align-items: center; gap: 8px; }
        .box {
          width: var(--check-size, 18px); height: var(--check-size, 18px);
          background: ${active ? (isSecondary ? "var(--check-active-bg-secondary, var(--secondary-accent-3))" : "var(--check-active-bg, var(--primary-accent-3))") : "var(--check-bg, var(--bg))"};
          background-origin: var(--check-bg-origin, border-box);
          border: var(--check-border-width, 2px) solid ${active ? (isSecondary ? "var(--check-active-border-secondary, var(--secondary-accent-3))" : "var(--check-active-border, var(--primary-accent-3))") : "var(--check-border, var(--neutral-5))"};
          border-radius: var(--check-radius, 4px);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.12s, border-color 0.12s;
          flex-shrink: 0;
          box-shadow: var(--check-shadow, none);
          position: relative;
          isolation: isolate;
        }
        .box::before {
          content: '';
          position: absolute;
          inset: var(--check-bevel-width, 0px);
          border-radius: calc(var(--check-radius, 4px) - var(--check-bevel-width, 0px));
          background: ${active ? (isSecondary ? "var(--check-active-overlay-secondary, var(--check-overlay, none))" : "var(--check-active-overlay, var(--check-overlay, none))") : "var(--check-overlay, none)"};
          z-index: -1;
          pointer-events: none;
          transition: background 0.12s;
        }
        .wrap:hover .box:not(.active) {
          border-color: var(--check-hover-border, ${accentVar});
          background: var(--check-hover-bg, var(--neutral-3));
          background-origin: var(--check-bg-origin, border-box);
        }
        .wrap:hover .box:not(.active)::before {
          background: var(--check-hover-overlay, var(--check-overlay, none));
        }
        .mark {
          color: ${active ? (isSecondary ? "var(--check-mark-color-secondary, var(--check-mark-color, var(--bg)))" : "var(--check-mark-color, var(--bg))") : "var(--check-mark-off-color, transparent)"};
          font-size: 13px;
          font-weight: bold;
          line-height: 1;
          text-shadow: ${active ? (isSecondary ? "var(--check-mark-glow-secondary, var(--check-mark-glow, none))" : "var(--check-mark-glow, none)") : "none"};
          position: relative;
        }
        .label {
          font: 13px/1 var(--font-display, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
          color: var(--fg);
        }
      </style>
      <div class="wrap">
        <div class="box${active ? " active" : ""}">
          <span class="mark">${checked ? "✓" : indeterminate ? "–" : "✓"}</span>
        </div>
        ${label ? `<span class="label">${label}</span>` : ""}
      </div>`;

    this.shadowRoot.querySelector(".wrap").addEventListener("click", () => {
      if (this.hasAttribute("disabled")) return;
      if (this.hasAttribute("indeterminate")) this.removeAttribute("indeterminate");
      if (this.hasAttribute("checked")) this.removeAttribute("checked");
      else this.setAttribute("checked", "");
      this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { checked: this.hasAttribute("checked") } }));
    });
  }
}

/* ================================================================
   <radio-button>  — Flat radio button
   ================================================================ */

class RadioButton extends HTMLElement {
  static get observedAttributes() { return ["checked", "disabled", "label", "name", "accent"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.shadowRoot.querySelector(".wrap")) this._render(); }

  _render() {
    const checked = this.hasAttribute("checked");
    const label = this.getAttribute("label") || "";
    const isSecondary = this.getAttribute("accent") === "secondary";
    const accentVar = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; user-select: none; cursor: pointer; }
        :host([disabled]) { pointer-events: none; }
        :host([disabled]) .circle {
          opacity: var(--radio-disabled-opacity, 0.38);
          background: var(--radio-disabled-bg, var(--radio-bg, none));
          background-origin: var(--radio-bg-origin, border-box);
          border-color: var(--radio-disabled-border, var(--radio-border, var(--neutral-5)));
        }
        :host([disabled]) .circle::before {
          background: var(--radio-disabled-overlay, var(--radio-overlay, none));
        }
        :host([disabled]) .dot { display: none; }
        .wrap { display: flex; align-items: center; gap: 8px; }
        .circle {
          width: var(--radio-size, 18px); height: var(--radio-size, 18px);
          background: ${checked ? (isSecondary ? "var(--radio-active-bg-secondary, var(--radio-bg, none))" : "var(--radio-active-bg, var(--radio-bg, none))") : "var(--radio-bg, none)"};
          background-origin: var(--radio-bg-origin, border-box);
          border: var(--radio-border-width, 2px) solid ${checked ? (isSecondary ? "var(--radio-active-border-secondary, var(--secondary-accent-3))" : "var(--radio-active-border, var(--primary-accent-3))") : "var(--radio-border, var(--neutral-5))"};
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.12s, background 0.12s;
          flex-shrink: 0;
          box-shadow: var(--radio-shadow, none);
          position: relative;
          isolation: isolate;
        }
        .circle::before {
          content: '';
          position: absolute;
          inset: var(--radio-bevel-width, 0px);
          border-radius: 50%;
          background: ${checked ? (isSecondary ? "var(--radio-active-overlay-secondary, var(--radio-overlay, none))" : "var(--radio-active-overlay, var(--radio-overlay, none))") : "var(--radio-overlay, none)"};
          z-index: -1;
          pointer-events: none;
          transition: background 0.12s;
        }
        .wrap:hover .circle:not(.active) {
          border-color: var(--radio-hover-border, ${accentVar});
          background: var(--radio-hover-bg, var(--neutral-3));
          background-origin: var(--radio-bg-origin, border-box);
        }
        .wrap:hover .circle:not(.active)::before {
          background: var(--radio-hover-overlay, var(--radio-overlay, none));
        }
        .dot {
          width: var(--radio-dot-size, 10px); height: var(--radio-dot-size, 10px);
          background: ${checked ? (isSecondary ? "var(--radio-dot-bg-secondary, var(--secondary-accent-3))" : "var(--radio-dot-bg, var(--primary-accent-3))") : "var(--radio-dot-off-bg, transparent)"};
          border-radius: 50%;
          display: ${checked ? "block" : "var(--radio-dot-off-display, none)"};
          box-shadow: ${checked ? (isSecondary ? "var(--radio-dot-glow-secondary, var(--radio-dot-glow, none))" : "var(--radio-dot-glow, none)") : "none"};
          transition: opacity 0.12s;
          position: relative;
        }
        .label {
          font: 13px/1 var(--font-display, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
          color: var(--fg);
        }
      </style>
      <div class="wrap">
        <div class="circle${checked ? " active" : ""}"><div class="dot"></div></div>
        ${label ? `<span class="label">${label}</span>` : ""}
      </div>`;

    this.shadowRoot.querySelector(".wrap").addEventListener("click", () => {
      if (this.hasAttribute("disabled")) return;
      const group = this.getAttribute("name");
      if (group) {
        document.querySelectorAll(`radio-button[name="${group}"]`).forEach((r) => r.removeAttribute("checked"));
      }
      this.setAttribute("checked", "");
      this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { checked: true } }));
    });
  }
}

/* ================================================================
   <toggle-switch>  — Flat toggle
   ================================================================ */

class ToggleSwitch extends HTMLElement {
  static get observedAttributes() { return ["checked", "disabled", "label", "accent"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.shadowRoot.querySelector(".track")) this._render(); }

  _render() {
    const on = this.hasAttribute("checked");
    const label = this.getAttribute("label") || "";
    const isSecondary = this.getAttribute("accent") === "secondary";
    const accentVar = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; user-select: none; cursor: pointer; }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }
        .wrap { display: flex; align-items: center; gap: 10px; }
        .track {
          width: var(--toggle-width, 40px); height: var(--toggle-height, 22px);
          background: ${on ? (isSecondary ? "var(--toggle-bg-on-secondary, var(--secondary-accent-3))" : "var(--toggle-bg-on, var(--primary-accent-3))") : "var(--toggle-bg-off, var(--neutral-3))"};
          background-origin: var(--toggle-bg-origin, border-box);
          border: var(--toggle-border-width, 1px) solid ${on ? (isSecondary ? "var(--toggle-border-on-secondary, var(--secondary-accent-3))" : "var(--toggle-border-on, var(--primary-accent-3))") : "var(--toggle-border-off, var(--neutral-5))"};
          border-radius: var(--toggle-radius, 11px);
          position: relative;
          transition: background 0.15s, border-color 0.15s;
          box-shadow: var(--toggle-shadow, none);
          isolation: isolate;
        }
        .track::before {
          content: '';
          position: absolute;
          inset: var(--toggle-bevel-width, 0px);
          border-radius: calc(var(--toggle-radius, 11px) - var(--toggle-bevel-width, 0px));
          background: ${on ? (isSecondary ? "var(--toggle-overlay-on-secondary, var(--toggle-overlay, none))" : "var(--toggle-overlay-on, var(--toggle-overlay, none))") : "var(--toggle-overlay, none)"};
          z-index: 0;
          pointer-events: none;
          transition: background 0.15s;
        }
        .split {
          display: var(--toggle-split-display, none);
          position: absolute;
          left: var(--toggle-split-pad, var(--toggle-bevel-width, 0px));
          right: var(--toggle-split-pad, var(--toggle-bevel-width, 0px));
          top: 50%;
          height: var(--toggle-split-height, 2px);
          transform: translateY(-50%);
          background: var(--toggle-split-color, var(--bg));
          border-radius: 1.5px;
          z-index: 1;
          pointer-events: none;
        }
        .wrap:hover .track:not(.active) {
          background: var(--toggle-hover-bg, var(--neutral-5));
          background-origin: var(--toggle-bg-origin, border-box);
          border-color: var(--toggle-hover-border, ${accentVar});
        }
        .wrap:hover .track:not(.active)::before {
          background: var(--toggle-hover-overlay, var(--toggle-overlay, none));
        }
        .thumb {
          width: var(--toggle-thumb-size, 16px); height: var(--toggle-thumb-size, 16px);
          background: ${on ? (isSecondary ? "var(--toggle-thumb-on-secondary, var(--secondary-accent-1))" : "var(--toggle-thumb-on, var(--primary-accent-1))") : "var(--toggle-thumb, var(--neutral-7))"};
          background-origin: var(--toggle-thumb-bg-origin, border-box);
          border: ${on ? (isSecondary ? "var(--toggle-thumb-border-on-secondary, var(--toggle-thumb-border-on, 1px solid var(--secondary-accent-3)))" : "var(--toggle-thumb-border-on, 1px solid var(--primary-accent-3))") : "var(--toggle-thumb-border, none)"};
          border-radius: 50%;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          left: ${on ? "var(--toggle-thumb-on-left, 21px)" : "var(--toggle-thumb-off-left, 3px)"};
          transition: left 0.15s, background 0.15s, filter 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
          box-shadow: ${on ? (isSecondary ? "var(--toggle-thumb-glow-secondary, var(--toggle-thumb-glow, none))" : "var(--toggle-thumb-glow, none)") : "none"};
          z-index: 2;
          isolation: isolate;
          display: flex; align-items: center; justify-content: center;
        }
        .thumb::before {
          content: '';
          position: absolute;
          inset: var(--toggle-thumb-bevel, 0px);
          border-radius: 50%;
          background: ${on ? (isSecondary ? "var(--toggle-thumb-overlay-on-secondary, var(--toggle-thumb-overlay, none))" : "var(--toggle-thumb-overlay-on, var(--toggle-thumb-overlay, none))") : "var(--toggle-thumb-overlay, none)"};
          z-index: -1;
          pointer-events: none;
        }
        .indicator {
          display: var(--toggle-indicator-display, none);
          width: var(--toggle-indicator-size, 6px); height: var(--toggle-indicator-size, 6px);
          background: ${on ? (isSecondary ? "var(--toggle-indicator-on-secondary, var(--secondary-accent-1))" : "var(--toggle-indicator-on, var(--primary-accent-1))") : "var(--toggle-indicator-off, var(--neutral-3))"};
          border-radius: 50%;
          position: relative;
          z-index: 1;
          box-shadow: ${on ? (isSecondary ? "var(--toggle-indicator-glow-secondary, var(--toggle-indicator-glow, none))" : "var(--toggle-indicator-glow, none)") : "none"};
        }
        .label {
          font: 13px/1 var(--font-display, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
          color: var(--fg);
        }
      </style>
      <div class="wrap">
        <div class="track${on ? " active" : ""}">
          <div class="split"></div>
          <div class="thumb"><div class="indicator"></div></div>
        </div>
        ${label ? `<span class="label">${label}</span>` : ""}
      </div>`;

    this.shadowRoot.querySelector(".wrap").addEventListener("click", () => {
      if (this.hasAttribute("disabled")) return;
      if (on) this.removeAttribute("checked");
      else this.setAttribute("checked", "");
      this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { checked: !on } }));
    });
  }
}

/* ================================================================
   <segmented-control>  — Flat segmented control (replaces volume-style)
   ================================================================ */

class SegmentedControl extends HTMLElement {
  static get observedAttributes() { return ["values", "keys", "value", "columns", "disabled", "accent", "no-hover-edge"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._values = [];   // display labels
    this._keys = [];     // stable identifiers (optional, defaults to values)
    this._value = "";    // currently selected key (or display value if no keys)
    this._columns = 4;
    this._ro = null;
  }

  connectedCallback() { this._readAttrs(); this._render(); this._observeSize(); }
  disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
  attributeChangedCallback() {
    this._readAttrs();
    if (this.shadowRoot.querySelector(".grid")) { this._render(); this._observeSize(); }
  }

  _observeSize() {
    const seg = this.shadowRoot.querySelector(".seg");
    if (!seg) return;
    if (this._ro) this._ro.disconnect();
    this._ro = new ResizeObserver(() =>
      _scaleBevel(this, seg, "--seg-bevel-ref-height", "--seg-bevel-ref-pad", "--seg-bevel-width")
    );
    this._ro.observe(seg);
  }

  _readAttrs() {
    const prevIndex = this._values.indexOf(this._value);
    const raw = this.getAttribute("values");
    if (raw) {
      try { this._values = JSON.parse(raw); }
      catch { this._values = raw.split(",").map((s) => s.trim()); }
    }
    const rawKeys = this.getAttribute("keys");
    if (rawKeys) {
      try { this._keys = JSON.parse(rawKeys); }
      catch { this._keys = rawKeys.split(",").map((s) => s.trim()); }
    } else {
      this._keys = [];
    }
    // value attr stores the key (or display value when no keys)
    const attrVal = this.getAttribute("value");
    if (this._keys.length) {
      this._value = attrVal || this._keys[0] || "";
    } else {
      // If current value no longer matches new labels, preserve by index
      if (attrVal && this._values.includes(attrVal)) {
        this._value = attrVal;
      } else if (prevIndex >= 0 && prevIndex < this._values.length) {
        this._value = this._values[prevIndex];
        this.setAttribute("value", this._value);
      } else {
        this._value = this._values[0] || "";
      }
    }
    this._columns = parseInt(this.getAttribute("columns") ?? 4, 10);
  }

  /** Map a display label → key, or key → key */
  _keyOf(index) { return this._keys.length ? this._keys[index] : this._values[index]; }

  _render() {
    const cols = this._columns;
    const total = this._values.length;
    const rows = Math.ceil(total / cols);
    const isSecondary = this.getAttribute("accent") === "secondary";
    const accentBg  = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";
    const accentFg  = "var(--bg)";
    const hoverEdge = isSecondary ? "var(--secondary-accent-3)" : "var(--primary-accent-3)";
    const noHoverEdge = this.hasAttribute("no-hover-edge");

    const items = this._values.map((v, i) => {
      const key = this._keyOf(i);
      const sel = key === this._value;
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colsInRow = Math.min(cols, total - row * cols);
      const r = 6;
      const tl = (row === 0 && col === 0) ? r : 0;
      const tr = (row === 0 && col === colsInRow - 1) ? r : 0;
      const bl = (row === rows - 1 && col === 0) ? r : 0;
      const br = (row === rows - 1 && col === colsInRow - 1) ? r : 0;
      return `<button class="seg${sel ? " active" : ""}" data-key="${key}" data-index="${i}"
        style="border-radius:${tl}px ${tr}px ${br}px ${bl}px">${v}</button>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block; user-select: none; -webkit-user-select: none;
          border-radius: var(--seg-radius, 5px);
          box-shadow: var(--seg-shadow, none);
        }
        :host([disabled]) { pointer-events: none; }
        :host([disabled]) .grid { opacity: 0.38; }
        .grid {
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
        }
        .seg {
          padding: var(--seg-padding, 7px 10px);
          font-size: var(--seg-font-size, 13px);
          line-height: 1;
          font-family: var(--font-display, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
          background: var(--seg-bg, var(--neutral-3));
          background-origin: var(--seg-bg-origin, border-box);
          color: var(--seg-fg, var(--fg));
          border: 1px solid var(--seg-border, var(--neutral-5));
          margin: -0.5px;
          cursor: pointer;
          position: relative; isolation: isolate;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .seg::before {
          content: '';
          position: absolute;
          inset: var(--seg-bevel-width, 0px);
          border-radius: inherit;
          background: var(--seg-overlay, none);
          z-index: -1;
          transition: background 0.12s;
          pointer-events: none;
        }
        .seg:hover:not(.active) {
          z-index: 2;
          background: var(--seg-hover-bg, var(--neutral-5));
          background-origin: var(--seg-bg-origin, border-box);
          ${noHoverEdge ? "" : `border-color: var(--seg-hover-border, ${hoverEdge});`}
        }
        .seg:hover:not(.active)::before {
          background: var(--seg-hover-overlay, var(--seg-overlay, none));
        }
        .seg.active {
          z-index: 1;
          background: ${isSecondary ? `var(--seg-active-bg-secondary, ${accentBg})` : `var(--seg-active-bg, ${accentBg})`};
          background-origin: var(--seg-bg-origin, border-box);
          color: ${isSecondary ? `var(--seg-active-fg-secondary, var(--seg-active-fg, ${accentFg}))` : `var(--seg-active-fg, ${accentFg})`};
          border-color: var(--seg-active-border, var(--neutral-5));
          text-shadow: ${isSecondary ? `var(--seg-active-text-shadow-secondary, var(--seg-active-text-shadow, none))` : `var(--seg-active-text-shadow, none)`};
        }
        .seg.active::before {
          background: ${isSecondary ? `var(--seg-active-overlay-secondary, var(--seg-overlay, none))` : `var(--seg-active-overlay, var(--seg-overlay, none))`};
        }
      </style>
      <div class="grid">${items}</div>`;

    this.shadowRoot.querySelectorAll(".seg").forEach((el) => {
      el.addEventListener("pointerup", () => {
        const key = el.dataset.key;
        if (key === this._value) return;
        this._value = key;
        this.setAttribute("value", key);
        this._render();
        this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: key } }));
      });
    });
  }

  getValue() { return this._value; }
  setValue(v) {
    const valid = this._keys.length ? this._keys.includes(v) : this._values.includes(v);
    if (valid) {
      this._value = v;
      this.setAttribute("value", v);
      this._render();
    }
  }
}

/* ================================================================
   <vertical-slider>  — Flat vertical slider
   ================================================================ */

class VerticalSlider extends HTMLElement {
  static get observedAttributes() { return ["min", "max", "value", "value2", "disabled", "label", "mode"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._dragging = null; // null | "thumb" | "thumb2"
  }

  connectedCallback() { this._render(); this._bindDrag(); }
  attributeChangedCallback() {
    if (!this.shadowRoot.querySelector(".track")) return;
    if (this._dragging) { this._updateVisuals(); return; }
    this._render(); this._bindDrag();
  }

  get _min()  { return parseFloat(this.getAttribute("min") ?? 0); }
  get _max()  { return parseFloat(this.getAttribute("max") ?? 100); }
  get _val()  { return parseFloat(this.getAttribute("value") ?? 50); }
  get _val2() { return parseFloat(this.getAttribute("value2") ?? 75); }
  get _mode() { return this.getAttribute("mode") || "progress"; }

  _frac(v) { return (v - this._min) / (this._max - this._min); }

  _render() {
    const mode = this._mode;
    const label = this.getAttribute("label") || "";
    const showFill = mode !== "value";
    const isRange = mode === "range";
    const accentVar = "var(--primary-accent-3)";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; flex-direction: column; align-items: center; user-select: none; }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }
        .wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .track-container {
          width: 32px; height: 140px;
          display: flex; align-items: flex-end; justify-content: center;
          position: relative; cursor: pointer;
          touch-action: none;
        }
        .track {
          width: var(--track-width, 6px); height: 100%;
          background: var(--track-bg, var(--neutral-3));
          border: var(--track-border, none);
          border-radius: var(--track-radius, 3px);
          position: relative;
          box-sizing: border-box;
          box-shadow: var(--track-shadow, none);
        }
        .fill {
          position: absolute; left: 0; right: 0;
          background: var(--fill-bg, ${accentVar});
          border-radius: var(--track-radius, 3px);
          display: ${showFill ? "block" : "none"};
          box-shadow: var(--fill-glow, none);
        }
        .thumb, .thumb2 {
          width: var(--thumb-w, 16px); height: var(--thumb-h, 16px);
          background: var(--thumb-center, var(--neutral-3));
          background-origin: var(--thumb-bg-origin, border-box);
          border: var(--thumb-border, 3px solid var(--thumb-ring, var(--primary-accent-3)));
          border-radius: var(--thumb-radius, 50%);
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2;
          cursor: grab;
          box-shadow: var(--thumb-shadow, none);
          outline: var(--thumb-outline, none);
          outline-offset: 0px;
          box-sizing: border-box;
          isolation: isolate;
        }
        .thumb::before, .thumb2::before {
          content: '';
          position: absolute;
          inset: var(--thumb-bevel, 0px);
          border-radius: calc(var(--thumb-radius, 50%) - var(--thumb-bevel, 0px));
          background: var(--thumb-overlay, none);
          z-index: -1;
          pointer-events: none;
        }
        .thumb::after, .thumb2::after {
          content: '';
          display: var(--thumb-indicator-display, none);
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: var(--thumb-indicator-w, 60%);
          height: var(--thumb-indicator-h, 2px);
          border-radius: var(--thumb-indicator-radius, 1px);
          background: var(--thumb-indicator-bg, var(--primary-accent-3));
          box-shadow: var(--thumb-indicator-glow, none);
          z-index: 1;
        }
        .thumb2 { display: ${isRange ? "block" : "none"}; }
        .label { font: 11px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.5; }
        .val { font: 11px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.7; font-variant-numeric: tabular-nums; min-width: ${isRange ? '7ch' : '3ch'}; text-align: center; }
      </style>
      <div class="wrap">
        <span class="val"></span>
        <div class="track-container">
          <div class="track"><div class="fill"></div></div>
          <div class="thumb"></div>
          <div class="thumb2"></div>
        </div>
        ${label ? `<span class="label">${label}</span>` : ""}
      </div>`;
    this._updateVisuals();
  }

  _updateVisuals() {
    const mode = this._mode;
    const f1 = this._frac(this._val);
    const p1 = f1 * 100;
    const thumb = this.shadowRoot.querySelector(".thumb");
    const fill  = this.shadowRoot.querySelector(".fill");
    const valEl = this.shadowRoot.querySelector(".val");
    if (!thumb) return;
    thumb.style.bottom = `calc(${p1}% - 8px)`;
    if (mode === "range") {
      const f2 = this._frac(this._val2);
      const p2 = f2 * 100;
      const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
      fill.style.bottom = lo + "%";
      fill.style.height = (hi - lo) + "%";
      const thumb2 = this.shadowRoot.querySelector(".thumb2");
      if (thumb2) thumb2.style.bottom = `calc(${p2}% - 8px)`;
      if (valEl) valEl.textContent = `${Math.round(this._val)}–${Math.round(this._val2)}`;
    } else {
      fill.style.bottom = "0";
      fill.style.height = p1 + "%";
      if (valEl) valEl.textContent = Math.round(this._val);
    }
  }

  _bindDrag() {
    const container = this.shadowRoot.querySelector(".track-container");
    if (!container) return;
    container.addEventListener("pointerdown", (e) => this._onPointerDown(e, container));
  }

  _onPointerDown(e, container) {
    if (this.hasAttribute("disabled")) return;
    e.preventDefault();
    container.setPointerCapture(e.pointerId);
    const rect = container.getBoundingClientRect();
    const clickFrac = 1 - (e.clientY - rect.top) / rect.height;
    // Determine which thumb to move
    if (this._mode === "range") {
      const d1 = Math.abs(clickFrac - this._frac(this._val));
      const d2 = Math.abs(clickFrac - this._frac(this._val2));
      this._dragging = d1 <= d2 ? "thumb" : "thumb2";
    } else {
      this._dragging = "thumb";
    }
    const update = (ev) => {
      const r = container.getBoundingClientRect();
      const pct = 1 - Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      let val = Math.round(this._min + pct * (this._max - this._min));
      if (this._mode === "range") {
        if (this._dragging === "thumb") val = Math.min(val, this._val2);
        else val = Math.max(val, this._val);
      }
      if (this._dragging === "thumb2") this.setAttribute("value2", val);
      else this.setAttribute("value", val);
      this._updateVisuals();
      this.dispatchEvent(new CustomEvent("input", { bubbles: true, detail: { value: this._val, value2: this._val2 } }));
    };
    update(e);
    const move = (ev) => { if (this._dragging) update(ev); };
    const up = () => { this._dragging = null; container.removeEventListener("pointermove", move); };
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up, { once: true });
    container.addEventListener("lostpointercapture", up, { once: true });
  }
}

/* ================================================================
   <range-slider>  — Flat horizontal slider
   ================================================================ */

class RangeSlider extends HTMLElement {
  static get observedAttributes() { return ["min", "max", "value", "value2", "disabled", "label", "mode"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._dragging = null;
  }

  connectedCallback() { this._render(); this._bindDrag(); }
  attributeChangedCallback() {
    if (!this.shadowRoot.querySelector(".track")) return;
    if (this._dragging) { this._updateVisuals(); return; }
    this._render(); this._bindDrag();
  }

  get _min()  { return parseFloat(this.getAttribute("min") ?? 0); }
  get _max()  { return parseFloat(this.getAttribute("max") ?? 100); }
  get _val()  { return parseFloat(this.getAttribute("value") ?? 50); }
  get _val2() { return parseFloat(this.getAttribute("value2") ?? 75); }
  get _mode() { return this.getAttribute("mode") || "progress"; }

  _frac(v) { return (v - this._min) / (this._max - this._min); }

  _render() {
    const mode = this._mode;
    const label = this.getAttribute("label") || "";
    const showFill = mode !== "value";
    const isRange = mode === "range";
    const accentVar = "var(--primary-accent-3)";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; user-select: none; }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }
        .wrap { display: flex; flex-direction: column; gap: 6px; }
        .label-row { display: flex; justify-content: space-between; }
        .lbl { font: 12px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.5; }
        .val { font: 12px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.7; font-variant-numeric: tabular-nums; min-width: ${isRange ? '7ch' : '3ch'}; text-align: right; }
        .track {
          width: 100%; height: var(--track-height, 6px);
          background: var(--track-bg, var(--neutral-3));
          border: var(--track-border, none);
          border-radius: var(--track-radius, 3px);
          position: relative; cursor: pointer;
          touch-action: none;
          box-sizing: border-box;
          box-shadow: var(--track-shadow, none);
        }
        .fill {
          position: absolute; top: 0; bottom: 0;
          background: var(--fill-bg, ${accentVar});
          border-radius: var(--track-radius, 3px);
          display: ${showFill ? "block" : "none"};
          box-shadow: var(--fill-glow, none);
        }
        .thumb, .thumb2 {
          width: var(--thumb-w, 16px); height: var(--thumb-h, 16px);
          background: var(--thumb-center, var(--neutral-3));
          background-origin: var(--thumb-bg-origin, border-box);
          border: var(--thumb-border, 3px solid var(--thumb-ring, var(--primary-accent-3)));
          border-radius: var(--thumb-radius, 50%);
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 2;
          cursor: grab;
          box-shadow: var(--thumb-shadow, none);
          outline: var(--thumb-outline, none);
          outline-offset: 0px;
          box-sizing: border-box;
          isolation: isolate;
        }
        .thumb::before, .thumb2::before {
          content: '';
          position: absolute;
          inset: var(--thumb-bevel, 0px);
          border-radius: calc(var(--thumb-radius, 50%) - var(--thumb-bevel, 0px));
          background: var(--thumb-overlay, none);
          z-index: -1;
          pointer-events: none;
        }
        .thumb::after, .thumb2::after {
          content: '';
          display: var(--thumb-indicator-display, none);
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: var(--thumb-indicator-w, 2px);
          height: var(--thumb-indicator-h, 60%);
          border-radius: var(--thumb-indicator-radius, 1px);
          background: var(--thumb-indicator-bg, var(--primary-accent-3));
          box-shadow: var(--thumb-indicator-glow, none);
          z-index: 1;
        }
        .thumb2 { display: ${isRange ? "block" : "none"}; }
      </style>
      <div class="wrap">
        ${label ? `<div class="label-row"><span class="lbl">${label}</span><span class="val"></span></div>` : ""}
        <div class="track">
          <div class="fill"></div>
          <div class="thumb"></div>
          <div class="thumb2"></div>
        </div>
      </div>`;
    this._updateVisuals();
  }

  _updateVisuals() {
    const mode = this._mode;
    const f1 = this._frac(this._val);
    const p1 = f1 * 100;
    const thumb = this.shadowRoot.querySelector(".thumb");
    const fill  = this.shadowRoot.querySelector(".fill");
    const valEl = this.shadowRoot.querySelector(".val");
    if (!thumb) return;
    thumb.style.left = p1 + "%";
    if (mode === "range") {
      const f2 = this._frac(this._val2);
      const p2 = f2 * 100;
      const lo = Math.min(p1, p2), hi = Math.max(p1, p2);
      fill.style.left = lo + "%";
      fill.style.width = (hi - lo) + "%";
      const thumb2 = this.shadowRoot.querySelector(".thumb2");
      if (thumb2) thumb2.style.left = p2 + "%";
      if (valEl) valEl.textContent = `${Math.round(this._val)}–${Math.round(this._val2)}`;
    } else {
      fill.style.left = "0";
      fill.style.width = p1 + "%";
      if (valEl) valEl.textContent = Math.round(this._val);
    }
  }

  _bindDrag() {
    const track = this.shadowRoot.querySelector(".track");
    if (!track) return;
    track.addEventListener("pointerdown", (e) => this._onPointerDown(e, track));
  }

  _onPointerDown(e, track) {
    if (this.hasAttribute("disabled")) return;
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    const rect = track.getBoundingClientRect();
    const clickFrac = (e.clientX - rect.left) / rect.width;
    if (this._mode === "range") {
      const d1 = Math.abs(clickFrac - this._frac(this._val));
      const d2 = Math.abs(clickFrac - this._frac(this._val2));
      this._dragging = d1 <= d2 ? "thumb" : "thumb2";
    } else {
      this._dragging = "thumb";
    }
    const update = (ev) => {
      const r = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      let val = Math.round(this._min + pct * (this._max - this._min));
      if (this._mode === "range") {
        if (this._dragging === "thumb") val = Math.min(val, this._val2);
        else val = Math.max(val, this._val);
      }
      if (this._dragging === "thumb2") this.setAttribute("value2", val);
      else this.setAttribute("value", val);
      this._updateVisuals();
      this.dispatchEvent(new CustomEvent("input", { bubbles: true, detail: { value: this._val, value2: this._val2 } }));
    };
    update(e);
    const move = (ev) => { if (this._dragging) update(ev); };
    const up = () => { this._dragging = null; track.removeEventListener("pointermove", move); };
    track.addEventListener("pointermove", move);
    track.addEventListener("pointerup", up, { once: true });
    track.addEventListener("lostpointercapture", up, { once: true });
  }
}

/* ================================================================
   <progress-bar>  — Flat progress bar
   ================================================================ */

class ProgressBar extends HTMLElement {
  static get observedAttributes() { return ["value", "max", "label"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.shadowRoot.querySelector(".track")) this._render(); }

  _render() {
    const max = parseFloat(this.getAttribute("max") ?? 100);
    const val = parseFloat(this.getAttribute("value") ?? 0);
    const pct = ((val / max) * 100).toFixed(1);
    const label = this.getAttribute("label") || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: flex; flex-direction: column; gap: 4px; }
        .label-row { display: flex; justify-content: space-between; }
        .lbl { font: 11px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.5; }
        .track {
          width: 100%; height: 6px;
          background: var(--track-bg, var(--neutral-3));
          border-radius: 3px;
          overflow: hidden;
        }
        .fill {
          height: 100%; width: ${pct}%;
          background: var(--primary-accent-3);
          border-radius: 3px;
          transition: width 0.2s;
        }
      </style>
      <div class="wrap">
        ${label ? `<div class="label-row"><span class="lbl">${label}</span><span class="lbl">${Math.round(val)}%</span></div>` : ""}
        <div class="track"><div class="fill"></div></div>
      </div>`;
  }
}

/* ================================================================
   <notification-bar>  — Flat notification / alert
   ================================================================ */

const NOTIF_STYLES = {
  note:    { icon: "ℹ",  bg: "color-mix(in oklab, var(--color-note) 15%, var(--bg))",    border: "var(--color-note)",    fg: "var(--color-note)" },
  message: { icon: "✉",  bg: "color-mix(in oklab, var(--color-message) 15%, var(--bg))", border: "var(--color-message)", fg: "var(--color-message)" },
  success: { icon: "✓",  bg: "color-mix(in oklab, var(--color-success) 15%, var(--bg))", border: "var(--color-success)", fg: "var(--color-success)" },
  warning: { icon: "⚠",  bg: "color-mix(in oklab, var(--color-warning) 15%, var(--bg))", border: "var(--color-warning)", fg: "var(--color-warning)" },
  error:   { icon: "✕",  bg: "color-mix(in oklab, var(--color-error) 15%, var(--bg))",   border: "var(--color-error)",   fg: "var(--color-error)" },
};

class NotificationBar extends HTMLElement {
  static get observedAttributes() { return ["type", "title", "message"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.shadowRoot.querySelector(".notif")) this._render(); }

  _render() {
    const type = this.getAttribute("type") || "note";
    const title = this.getAttribute("title") || type.charAt(0).toUpperCase() + type.slice(1);
    const message = this.getAttribute("message") || "";
    const s = NOTIF_STYLES[type] || NOTIF_STYLES.note;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .notif {
          display: flex; gap: 12px; align-items: flex-start;
          padding: var(--notif-padding, 12px 16px);
          background: var(--notif-bg, ${s.bg});
          border: 1px solid ${s.border};
          border-radius: var(--notif-radius, 8px);
          position: relative;
          overflow: hidden;
          box-shadow: var(--notif-shadow, none);
        }
        .notif::before {
          content: "";
          position: absolute; inset: 0;
          background: var(--notif-gradient, none);
          pointer-events: none;
          border-radius: inherit;
        }
        .icon {
          font-size: 16px; line-height: 1;
          color: ${s.fg};
          flex-shrink: 0;
          width: 20px; text-align: center;
        }
        .body { display: flex; flex-direction: column; gap: 2px; }
        .title { font: 600 13px/1.2 var(--font-display, system-ui, sans-serif); color: ${s.fg}; }
        .msg   { font: 12px/1.4 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.7; }
      </style>
      <div class="notif">
        <span class="icon">${s.icon}</span>
        <div class="body">
          <span class="title">${title}</span>
          ${message ? `<span class="msg">${message}</span>` : ""}
        </div>
      </div>`;
  }
}

/* ── Helper: resolve --font-display for canvas ctx.font ── */
function _chartFont() {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim()
    || "system-ui, sans-serif";
}

/* ================================================================
   <bar-chart>  — Canvas-based bar chart
   ================================================================ */

class BarChart extends HTMLElement {
  static get observedAttributes() { return ["data", "labels", "title", "flat", "glow"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); this._draw(); }
  attributeChangedCallback() { this._render(); this._draw(); }

  get _canvas() { return this.shadowRoot.querySelector("canvas"); }

  _parseData() {
    try { return JSON.parse(this.getAttribute("data") || "[]"); } catch { return []; }
  }
  _parseLabels() {
    try { return JSON.parse(this.getAttribute("labels") || "[]"); } catch { return []; }
  }

  _render() {
    const title = this.getAttribute("title") || "";
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: flex; flex-direction: column; gap: 6px; }
        .title { font: 600 13px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.7; }
        canvas { width: 100%; height: 160px; border-radius: 4px; box-shadow: var(--chart-shadow, none); }
      </style>
      <div class="wrap">
        ${title ? `<span class="title">${title}</span>` : ""}
        <canvas></canvas>
      </div>`;

    const ro = new ResizeObserver(() => this._draw());
    ro.observe(this.shadowRoot.querySelector("canvas"));
  }

  _draw() {
    const canvas = this._canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const data = this._parseData();
    const labels = this._parseLabels();
    if (!data.length) return;

    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--panel-bg").trim() || "#201e18";
    const fg = cs.getPropertyValue("--fg").trim() || "#e8e4d8";
    const gridC = cs.getPropertyValue("--edge-1").trim() || "#2a2820";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const pad = { top: 12, right: 12, bottom: 24, left: 32 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...data, 1);

    // Grid lines
    ctx.strokeStyle = gridC;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // Accent gradient anchored to full chart height (accent-1 at bottom, accent-5 at top)
    const accent1 = cs.getPropertyValue("--primary-accent-1").trim() || "#d08028";
    const accent5 = cs.getPropertyValue("--primary-accent-5").trim() || "#a05010";
    const isFlat = this.hasAttribute("flat");
    const isGlow = this.hasAttribute("glow");

    // For flat mode: rank bars to assign distinct category colors
    let rankMap;
    if (isFlat) {
      const ranked = data.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      rankMap = new Map();
      ranked.forEach((item, rank) => { rankMap.set(item.i, rank); });
    }

    // Bars with rounded top edges
    const barW = chartW / data.length * 0.7;
    const gap = chartW / data.length * 0.3;
    const cornerR = Math.min(barW / 2, 22);
    data.forEach((v, i) => {
      const barH = (v / maxVal) * chartH;
      const x = pad.left + i * (barW + gap) + gap / 2;
      const y = pad.top + chartH - barH;

      // Build the rounded-top rect path
      ctx.beginPath();
      ctx.moveTo(x, y + barH);
      ctx.lineTo(x, y + cornerR);
      ctx.arcTo(x, y, x + cornerR, y, cornerR);
      ctx.arcTo(x + barW, y, x + barW, y + cornerR, cornerR);
      ctx.lineTo(x + barW, y + barH);
      ctx.closePath();

      if (isGlow) {
        // Glow mode: empty fill, thick glowing accent edges
        const barGrad = ctx.createLinearGradient(x, pad.top, x, pad.top + chartH);
        barGrad.addColorStop(0, accent5);
        barGrad.addColorStop(1, accent1);
        ctx.save();
        ctx.strokeStyle = barGrad;
        ctx.lineWidth = 4;
        ctx.shadowColor = accent1;
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
      } else if (!isFlat) {
        // Gradient spans full chart height; bar shows its slice
        const barGrad = ctx.createLinearGradient(x, pad.top, x, pad.top + chartH);
        barGrad.addColorStop(0, accent5);
        barGrad.addColorStop(1, accent1);
        ctx.fillStyle = barGrad;
        ctx.fill();
      } else {
        // Flat: distinct category color per bar based on value rank
        const t = data.length > 1 ? rankMap.get(i) / (data.length - 1) : 0.5;
        const catIdx = Math.round(t * 6) + 1;
        ctx.fillStyle = cs.getPropertyValue(`--category-${catIdx}`).trim() || accent1;
        ctx.fill();
      }

      // Label
      if (labels[i]) {
        ctx.fillStyle = fg;
        ctx.globalAlpha = 0.5;
        ctx.font = `10px ${_chartFont()}`;
        ctx.textAlign = "center";
        ctx.fillText(labels[i], x + barW / 2, H - 6);
        ctx.globalAlpha = 1;
      }
    });
  }
}

/* ================================================================
   <line-chart>  — Canvas-based line / area chart
   Attributes: data (JSON array of series), labels, title, mode (line|area)
   ================================================================ */

class LineChart extends HTMLElement {
  static get observedAttributes() { return ["data", "labels", "title", "mode", "flat", "glow"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() { this._render(); this._draw(); }
  attributeChangedCallback() { this._render(); this._draw(); }

  get _canvas() { return this.shadowRoot.querySelector("canvas"); }

  _parseData() {
    try {
      const raw = JSON.parse(this.getAttribute("data") || "[]");
      // Accept either [n, n, ...] or [[n, n], [n, n]]
      if (raw.length && !Array.isArray(raw[0])) return [raw];
      return raw;
    } catch { return []; }
  }
  _parseLabels() {
    try { return JSON.parse(this.getAttribute("labels") || "[]"); } catch { return []; }
  }

  _render() {
    const title = this.getAttribute("title") || "";
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: flex; flex-direction: column; gap: 6px; }
        .title { font: 600 13px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.7; }
        canvas { width: 100%; height: 160px; border-radius: 4px; box-shadow: var(--chart-shadow, none); }
      </style>
      <div class="wrap">
        ${title ? `<span class="title">${title}</span>` : ""}
        <canvas></canvas>
      </div>`;

    const ro = new ResizeObserver(() => this._draw());
    ro.observe(this.shadowRoot.querySelector("canvas"));
  }

  _draw() {
    const canvas = this._canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const series = this._parseData();
    const labels = this._parseLabels();
    const mode = this.getAttribute("mode") || "line";
    if (!series.length) return;

    if (mode === "activity") { this._drawActivity(ctx, W, H, series, labels); return; }

    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--panel-bg").trim() || "#201e18";
    const fg = cs.getPropertyValue("--fg").trim() || "#e8e4d8";
    const gridC = cs.getPropertyValue("--edge-1").trim() || "#2a2820";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const pad = { top: 12, right: 12, bottom: 24, left: 32 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const allVals = series.flat();
    const maxVal = Math.max(...allVals, 1);

    // Grid
    ctx.strokeStyle = gridC;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // Labels
    if (labels.length) {
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.5;
      ctx.font = `10px ${_chartFont()}`;
      ctx.textAlign = "center";
      const step = chartW / Math.max(labels.length - 1, 1);
      labels.forEach((l, i) => ctx.fillText(l, pad.left + i * step, H - 6));
      ctx.globalAlpha = 1;
    }

    const accentKeys = ["--primary-accent-1", "--primary-accent-3", "--primary-accent-5",
                        "--secondary-accent-2", "--secondary-accent-4"];

    series.forEach((pts, si) => {
      const n = pts.length;
      if (n < 2) return;
      const step = chartW / (n - 1);
      const color = cs.getPropertyValue(accentKeys[si % accentKeys.length]).trim() || "#d08028";

      const coords = pts.map((v, i) => [pad.left + i * step, pad.top + chartH * (1 - v / maxVal)]);

      // Area fill
      if (mode === "area") {
        ctx.beginPath();
        ctx.moveTo(coords[0][0], pad.top + chartH);
        coords.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.lineTo(coords[n - 1][0], pad.top + chartH);
        ctx.closePath();
        if (!this.hasAttribute("flat")) {
          const areaGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
          areaGrad.addColorStop(0, color);
          areaGrad.addColorStop(1, "transparent");
          ctx.fillStyle = areaGrad;
          ctx.globalAlpha = 0.25;
        } else {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.15;
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Line
      ctx.beginPath();
      coords.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dots
      coords.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });
  }

  /* ── Activity chart: day/night background, scatter+line, sun/moon icons ── */
  _drawActivity(ctx, W, H, series, labels) {
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue("--panel-bg").trim() || "#201e18";
    const fg = cs.getPropertyValue("--fg").trim() || "#e8e4d8";
    const gridC = cs.getPropertyValue("--edge-1").trim() || "#2a2820";
    const dayColor = cs.getPropertyValue("--primary-accent-1").trim() || "#d08028";
    const nightColor = cs.getPropertyValue("--secondary-accent-5").trim() || "#4060c0";
    const lineColor = cs.getPropertyValue("--primary-accent-1").trim() || "#d08028";
    const sunColor = cs.getPropertyValue("--primary-accent-1").trim() || "#f0c030";
    const moonColor = cs.getPropertyValue("--secondary-accent-1").trim() || "#4060c0";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const pad = { top: 20, right: 12, bottom: 24, left: 32 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const pts = series[0] || [];
    const n = pts.length;
    if (n < 2) return;
    const maxVal = Math.max(...pts, 1);
    const totalHours = 48; // 2 days
    const pxPerHour = chartW / totalHours;

    // Day/night background bands for each day
    for (let day = 0; day < 2; day++) {
      const dayOffset = day * 24 * pxPerHour;
      // Night: 0–8h
      ctx.fillStyle = nightColor;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(pad.left + dayOffset, pad.top, 8 * pxPerHour, chartH);
      // Day: 8–24h
      ctx.fillStyle = dayColor;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(pad.left + dayOffset + 8 * pxPerHour, pad.top, 16 * pxPerHour, chartH);
      ctx.globalAlpha = 1;
    }

    // Grid
    ctx.strokeStyle = gridC;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // Data line + dots (samples every 3h for 48h = 17 points)
    const step = chartW / (n - 1);
    const coords = pts.map((v, i) => [pad.left + i * step, pad.top + chartH * (1 - v / maxVal)]);

    ctx.beginPath();
    coords.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    coords.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });

    // Sun/Moon icons at top — large, fully opaque
    const iconY = pad.top + 18;
    const isGlow = this.hasAttribute("glow");
    for (let day = 0; day < 2; day++) {
      const dayOffset = day * 24;
      // Moon at 4h — mirrored horizontally
      const moonX = pad.left + (dayOffset + 4) * pxPerHour;
      ctx.save();
      ctx.translate(moonX, iconY);
      ctx.scale(-1, 1);
      ctx.font = "36px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = moonColor;
      if (isGlow) { ctx.shadowColor = moonColor; ctx.shadowBlur = 12; }
      ctx.fillText("☽", 0, 0);
      ctx.restore();
      // Sun at 16h
      const sunX = pad.left + (dayOffset + 16) * pxPerHour;
      ctx.font = "36px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = sunColor;
      if (isGlow) { ctx.shadowColor = sunColor; ctx.shadowBlur = 12; }
      ctx.fillText("☀", sunX, iconY);
    }
    if (isGlow) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; }

    // Hour-based labels at 0, 8, 16, 24, 32, 40, 48
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.5;
    ctx.font = `10px ${_chartFont()}`;
    ctx.textAlign = "center";
    for (const h of [0, 8, 16, 24, 32, 40, 48]) {
      const x = pad.left + h * pxPerHour;
      ctx.fillText(String(h), x, H - 6);
    }
    ctx.globalAlpha = 1;
  }
}

/* ================================================================
   <date-calendar>  — Flat date-picker calendar
   ================================================================ */

function _calendarLocale() {
  return document.documentElement.lang || "en";
}
function _weekdays() {
  const loc = _calendarLocale();
  try {
    const fmt = new Intl.DateTimeFormat(loc, { weekday: "short" });
    // Monday=0 … Sunday=6   (2024-01-01 is Monday)
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 1 + i)).slice(0, 2)
    );
  } catch { return ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]; }
}
function _months() {
  const loc = _calendarLocale();
  try {
    const fmt = new Intl.DateTimeFormat(loc, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
  } catch {
    return ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
  }
}

class DateCalendar extends HTMLElement {
  static get observedAttributes() { return ["value", "end", "mode", "disabled"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const now = new Date();
    this._year = now.getFullYear();
    this._month = now.getMonth();
    this._selected = null;  // single mode selected date
    this._rangeStart = null; // range mode start date
    this._rangeEnd = null;   // range mode end date
    this._rangeStep = 0;     // 0 = next click sets start, 1 = next click sets end
  }

  connectedCallback() {
    const v = this.getAttribute("value");
    const mode = this.getAttribute("mode") || "single";
    if (v) {
      const d = new Date(v);
      this._year = d.getFullYear();
      this._month = d.getMonth();
      if (mode === "range") {
        this._rangeStart = v;
        this._rangeEnd = this.getAttribute("end") || v;
        this._rangeStep = 0;
      } else {
        this._selected = v;
      }
    }
    this._render();
    this._observeSize();
    this._onLangChange = () => { this._render(); this._observeSize(); };
    document.addEventListener("language-changed", this._onLangChange);
  }
  disconnectedCallback() {
    document.removeEventListener("language-changed", this._onLangChange);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  }
  attributeChangedCallback() {
    if (this.shadowRoot.querySelector(".cal")) { this._render(); this._observeSize(); }
  }

  _observeSize() {
    // Any day cell works — they all share the same height.
    const day = this.shadowRoot.querySelector(".day");
    if (!day) return;
    if (this._ro) this._ro.disconnect();
    this._ro = new ResizeObserver(() =>
      _scaleBevel(this, day, "--cal-bevel-ref-height", "--cal-bevel-ref-pad", "--cal-sel-bevel")
    );
    this._ro.observe(day);
  }

  _dateToStr(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  _render() {
    const year = this._year, month = this._month;
    const mode = this.getAttribute("mode") || "single";
    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = this._dateToStr(today.getFullYear(), today.getMonth(), today.getDate());

    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<span class="day blank"></span>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = this._dateToStr(year, month, d);
      let cls = "day";
      if (dateStr === todayStr) cls += " today";

      if (mode === "range") {
        const s = this._rangeStart, e = this._rangeEnd;
        if (s && e) {
          const lo = s <= e ? s : e;
          const hi = s <= e ? e : s;
          if (dateStr === lo || dateStr === hi) cls += " sel";
          else if (dateStr > lo && dateStr < hi) cls += " in-range";
        } else if (s && dateStr === s) {
          cls += " sel";
        }
      } else {
        if (dateStr === this._selected) cls += " sel";
      }
      cells += `<button class="${cls}" data-date="${dateStr}">${d}</button>`;
    }

    const weekHeaders = _weekdays().map((d) => `<span class="wday">${d}</span>`).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-block; user-select: none; }
        :host([disabled]) { opacity: 0.55; pointer-events: none; }
        .cal { display: flex; flex-direction: column; gap: 4px; min-width: 220px; background: var(--neutral-2, var(--bg)); border-radius: var(--cal-radius, 6px); padding: var(--cal-padding, 10px); }
        .nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 4px;
        }
        .nav-btn {
          background: none; border: none; color: var(--fg); opacity: 0.5;
          font: 16px/1 var(--font-display, system-ui, sans-serif); cursor: pointer; padding: 4px 8px;
        }
        .nav-btn:hover { opacity: 1; }
        .month-label { font: 600 13px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); }
        .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .wday {
          font: 600 10px/1 var(--font-display, system-ui, sans-serif); color: var(--fg); opacity: 0.35;
          text-align: center; padding: 4px 0;
        }
        .day {
          font: 12px/1 var(--font-display, system-ui, sans-serif); color: var(--fg);
          background: none; border: 1px solid transparent;
          border-radius: 4px; padding: 6px 0; text-align: center; cursor: pointer;
          position: relative;
        }
        .day:hover { background: var(--neutral-3); }
        .day.blank { pointer-events: none; }
        .day.today { border-color: var(--neutral-5); }
        .day.sel {
          background: var(--cal-sel-bg, var(--primary-accent-3)); color: var(--cal-sel-fg, var(--bg));
          background-origin: var(--cal-sel-bg-origin, border-box);
          border-color: var(--cal-sel-border, var(--primary-accent-3)); font-weight: 600;
          text-shadow: var(--cal-sel-text-shadow, none);
          isolation: isolate;
        }
        .day.sel::after {
          content: '';
          position: absolute;
          inset: var(--cal-sel-bevel, 0px);
          border-radius: calc(4px - var(--cal-sel-bevel, 0px));
          background: var(--cal-sel-overlay, none);
          pointer-events: none;
          z-index: -1;
        }
        .day.in-range {
          background: color-mix(in oklab, var(--primary-accent-3) 20%, transparent);
          border-radius: 0;
        }
      </style>
      <div class="cal">
        <div class="nav">
          <button class="nav-btn" id="prev">‹</button>
          <span class="month-label">${_months()[month]} ${year}</span>
          <button class="nav-btn" id="next">›</button>
        </div>
        <div class="grid">${weekHeaders}${cells}</div>
      </div>`;

    this.shadowRoot.getElementById("prev").addEventListener("click", () => {
      this._month--; if (this._month < 0) { this._month = 11; this._year--; }
      this._render();
    });
    this.shadowRoot.getElementById("next").addEventListener("click", () => {
      this._month++; if (this._month > 11) { this._month = 0; this._year++; }
      this._render();
    });
    this.shadowRoot.querySelectorAll(".day[data-date]").forEach((el) => {
      el.addEventListener("click", () => {
        const dateStr = el.dataset.date;
        if (mode === "range") {
          if (this._rangeStep === 0) {
            this._rangeStart = dateStr;
            this._rangeEnd = null;
            this._rangeStep = 1;
          } else {
            // Ensure start <= end
            if (dateStr < this._rangeStart) {
              this._rangeEnd = this._rangeStart;
              this._rangeStart = dateStr;
            } else {
              this._rangeEnd = dateStr;
            }
            this._rangeStep = 0;
          }
          this.setAttribute("value", this._rangeStart);
          if (this._rangeEnd) this.setAttribute("end", this._rangeEnd);
          this._render();
          this.dispatchEvent(new CustomEvent("change", {
            bubbles: true,
            detail: { start: this._rangeStart, end: this._rangeEnd }
          }));
        } else {
          this._selected = dateStr;
          this.setAttribute("value", this._selected);
          this._render();
          this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: this._selected } }));
        }
      });
    });
  }
}

/* ================================================================
   <color-picker>  — OKLCh colour picker with hue ring + L×C area
   Attributes: value (hex), disabled
   ================================================================ */

class ColorPicker extends HTMLElement {
  static get observedAttributes() { return ["value", "disabled", "size"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._L = 0.6; this._C = 0.15; this._h = 60;
    this._dragging = null; // "ring" | "area"
  }

  connectedCallback() {
    const hex = this.getAttribute("value") || "#d08028";
    this._fromHex(hex);
    this._render();
    this._draw();
  }

  attributeChangedCallback(name) {
    if (name === "value" && !this._dragging) {
      this._fromHex(this.getAttribute("value") || "#d08028");
      if (this.shadowRoot.querySelector("canvas")) this._draw();
    }
  }

  _fromHex(hex) {
    try {
      const [L, C, h] = hexToOklch(hex);
      this._L = L; this._C = C; this._h = h;
    } catch { /* keep current */ }
  }

  _toHex() { return oklchToHex([this._L, this._C, this._h]); }

  _render() {
    const size = parseInt(this.getAttribute("size")) || 180;
    const hideInput = this.hasAttribute("no-input");
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-block; user-select: none; }
        :host([disabled]) { opacity: 0.55; pointer-events: none; }
        .wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        canvas { border-radius: 50%; cursor: crosshair; }
        .hex-row { display: flex; align-items: center; gap: 6px; }
        .swatch-preview {
          width: 24px; height: 24px; border-radius: 4px;
          border: 1px solid var(--edge-1);
        }
        .hex-input {
          width: 80px; padding: 4px 6px;
          font: 12px/1 monospace;
          background: var(--neutral-3); color: var(--fg);
          border: 1px solid var(--neutral-4); border-radius: 4px;
        }
      </style>
      <div class="wrap">
        <canvas width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:0;"></canvas>
        ${hideInput ? '' : `<div class="hex-row">
          <div class="swatch-preview" id="preview"></div>
          <input class="hex-input" id="hexInput" type="text" maxlength="7" />
        </div>`}
      </div>`;

    const canvas = this.shadowRoot.querySelector("canvas");
    canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e, canvas));

    const hexInput = this.shadowRoot.getElementById("hexInput");
    if (hexInput) {
      hexInput.addEventListener("change", () => {
        let v = hexInput.value.trim();
        if (!v.startsWith("#")) v = "#" + v;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
          this._fromHex(v);
          this.setAttribute("value", this._toHex());
          this._draw();
          this._fireChange();
        }
      });
    }
  }

  _draw() {
    const canvas = this.shadowRoot.querySelector("canvas");
    if (!canvas) return;
    const size = canvas.width;
    const ctx = canvas.getContext("2d");
    const cx = size / 2, cy = size / 2;
    const outerR = size / 2 - 2;
    const ringW = Math.max(10, Math.round(size * 0.12));
    const innerR = outerR - ringW;

    ctx.clearRect(0, 0, size, size);

    // ── Hue ring (OKLCh) ──
    const ringImg = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= innerR && dist <= outerR) {
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;
          const hex = oklchToHex([0.7, 0.15, angle]);
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const i = (y * size + x) * 4;
          ringImg.data[i] = r; ringImg.data[i + 1] = g;
          ringImg.data[i + 2] = b; ringImg.data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(ringImg, 0, 0);

    // Hue indicator on ring
    const hRad = this._h * Math.PI / 180;
    const midR = (innerR + outerR) / 2;
    const hx = cx + midR * Math.cos(hRad);
    const hy = cy + midR * Math.sin(hRad);
    ctx.beginPath();
    ctx.arc(hx, hy, ringW / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── L × C rectangle inside ring ──
    const areaR = innerR - 6;
    const areaSize = Math.floor(areaR * Math.sqrt(2));
    const areaX = cx - areaSize / 2, areaY = cy - areaSize / 2;

    const areaImg = ctx.createImageData(areaSize, areaSize);
    for (let py = 0; py < areaSize; py++) {
      for (let px = 0; px < areaSize; px++) {
        const L = 1 - py / areaSize;              // top=1 (light) bottom=0 (dark)
        const C = (px / areaSize) * 0.37;          // left=0 right=max chroma
        const hex = oklchToHex([L, C, this._h]);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const i = (py * areaSize + px) * 4;
        areaImg.data[i] = r; areaImg.data[i + 1] = g;
        areaImg.data[i + 2] = b; areaImg.data[i + 3] = 255;
      }
    }

    // Draw area onto an offscreen canvas, then drawImage onto main
    const offscreen = document.createElement("canvas");
    offscreen.width = areaSize; offscreen.height = areaSize;
    offscreen.getContext("2d").putImageData(areaImg, 0, 0);
    ctx.drawImage(offscreen, areaX, areaY);

    // Area border
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(areaX, areaY, areaSize, areaSize);

    // L×C crosshair
    const cursorX = areaX + (this._C / 0.37) * areaSize;
    const cursorY = areaY + (1 - this._L) * areaSize;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Store area bounds for hit testing
    this._area = { x: areaX, y: areaY, size: areaSize };
    this._ring = { cx, cy, innerR, outerR };

    // Update preview + input
    const hex = this._toHex();
    const preview = this.shadowRoot.getElementById("preview");
    if (preview) preview.style.background = hex;
    const hexInput = this.shadowRoot.getElementById("hexInput");
    if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;
  }

  _onPointerDown(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
    const { cx, cy, innerR, outerR } = this._ring;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= innerR && dist <= outerR) {
      this._dragging = "ring";
    } else if (x >= this._area.x && x <= this._area.x + this._area.size &&
               y >= this._area.y && y <= this._area.y + this._area.size) {
      this._dragging = "area";
    } else {
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    this._updateFromPointer(x, y);

    const onMove = (ev) => {
      const mx = (ev.clientX - rect.left) * scaleX, my = (ev.clientY - rect.top) * scaleY;
      this._updateFromPointer(mx, my);
    };
    const onUp = () => {
      this._dragging = null;
      canvas.removeEventListener("pointermove", onMove);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp, { once: true });
  }

  _updateFromPointer(x, y) {
    if (this._dragging === "ring") {
      let angle = Math.atan2(y - this._ring.cy, x - this._ring.cx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      this._h = angle;
    } else if (this._dragging === "area") {
      const { x: ax, y: ay, size: as } = this._area;
      const px = Math.max(0, Math.min(1, (x - ax) / as));
      const py = Math.max(0, Math.min(1, (y - ay) / as));
      this._C = px * 0.37;
      this._L = 1 - py;
    }
    this._draw();
    const hex = this._toHex();
    this.setAttribute("value", hex);
    this._fireChange();
  }

  _fireChange() {
    this.dispatchEvent(new CustomEvent("change", {
      bubbles: true,
      detail: { value: this._toHex(), L: this._L, C: this._C, h: this._h },
    }));
  }

  getValue() { return this._toHex(); }
  setValue(hex) {
    this._fromHex(hex);
    this.setAttribute("value", hex);
    if (this.shadowRoot.querySelector("canvas")) this._draw();
  }
}

/* ================================================================
   Register all elements
   ================================================================ */

customElements.define("push-button", PushButton);
customElements.define("text-field", TextField);
customElements.define("check-box", CheckBox);
customElements.define("radio-button", RadioButton);
customElements.define("toggle-switch", ToggleSwitch);
customElements.define("segmented-control", SegmentedControl);
customElements.define("vertical-slider", VerticalSlider);
customElements.define("range-slider", RangeSlider);
customElements.define("progress-bar", ProgressBar);
customElements.define("notification-bar", NotificationBar);
customElements.define("bar-chart", BarChart);
customElements.define("line-chart", LineChart);
customElements.define("date-calendar", DateCalendar);
customElements.define("color-picker", ColorPicker);

/* Listen for palette changes and refresh token cache */
document.addEventListener("palette-changed", () => {
  refreshColors();
  // Redraw all canvas-based components
  document.querySelectorAll("bar-chart, line-chart, rotary-knob").forEach((el) => {
    if (el._draw) el._draw();
  });
});
