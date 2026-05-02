import { COLORS } from "../tokens.js";

/* ── Tweakable constants ── */
const GRAD_ANGLE_DEG    = 135;  // ← gradient direction (degrees, 0 = up, CW)
const CORNER_RADIUS_PCT = 16;   // ← border-radius as % of shorter dimension
const OUTER_PAD_PCT     = 6;    // ← outer rect padding relative to inner (%)

/* ================================================================== */

class SegmentedControl extends HTMLElement {

  static get observedAttributes() { return ["values", "value", "columns", "disabled"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._values  = [];
    this._value   = "";
    this._columns = 4;
  }

  connectedCallback() {
    this._readAttributes();
    this._buildDOM();
  }

  attributeChangedCallback() {
    this._readAttributes();
    if (this.shadowRoot.querySelector(".grid")) this._buildDOM();
  }

  _readAttributes() {
    const raw = this.getAttribute("values");
    if (raw) {
      try { this._values = JSON.parse(raw); }
      catch { this._values = raw.split(",").map(s => s.trim()); }
    }
    this._value   = this.getAttribute("value") || this._values[0] || "";
    this._columns = parseInt(this.getAttribute("columns") ?? 4, 10);
  }

  /* ---- DOM ---- */
  _buildDOM() {
    const gradA = GRAD_ANGLE_DEG;
    const gradB = GRAD_ANGLE_DEG + 180;
    const cr    = CORNER_RADIUS_PCT;
    const pad   = OUTER_PAD_PCT;
    const cols  = this._columns;

    const segmentItems = this._values.map((v) => {
      const selected = v === this._value;
      const outerBg = selected
        ? `linear-gradient(${gradA}deg, ${COLORS.accent1}, ${COLORS.accent2})`
        : `linear-gradient(${gradA}deg, ${COLORS.neutral1}, ${COLORS.neutral2})`;
      const innerBg = selected
        ? `linear-gradient(${gradB}deg, ${COLORS.accent1}, ${COLORS.accent2})`
        : `linear-gradient(${gradB}deg, ${COLORS.neutral1}, ${COLORS.neutral2})`;
      const textColor = selected ? COLORS.bg : COLORS.fg;
      const fontWeight = selected ? "bold" : "normal";

      return `
        <div class="seg-outer" data-value="${v}" style="background:${outerBg}">
          <div class="seg-inner" style="background:${innerBg}">
            <span style="color:${textColor};font-weight:${fontWeight}">${v}</span>
          </div>
        </div>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          user-select: none;
          -webkit-user-select: none;
        }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }

        .grid {
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap: 4px;
        }
        .seg-outer {
          border-radius: ${cr}%;
          padding: ${pad}%;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.10s ease;
        }
        .seg-outer:active {
          filter: brightness(0.85);
          transform: scale(0.95);
        }
        .seg-inner {
          border-radius: ${cr}%;
          padding: 7px 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .seg-inner span {
          font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: nowrap;
          pointer-events: none;
        }
      </style>
      <div class="grid">${segmentItems}</div>`;

    // Click handlers
    this.shadowRoot.querySelectorAll(".seg-outer").forEach((el) => {
      el.addEventListener("pointerup", () => {
        const v = el.dataset.value;
        if (v === this._value) return;
        this._value = v;
        this.setAttribute("value", v);
        this._buildDOM(); // re-render selection
        this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: v } }));
      });
    });
  }

  /* ---- public API ---- */
  getValue() { return this._value; }
  setValue(v) {
    if (this._values.includes(v)) {
      this._value = v;
      this.setAttribute("value", v);
      this._buildDOM();
    }
  }
}

customElements.define("segmented-control", SegmentedControl);
