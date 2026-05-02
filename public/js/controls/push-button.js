import { COLORS } from "../tokens.js";

/* ── Tweakable constants ── */
const GRAD_ANGLE_DEG    = 135;  // ← gradient direction (degrees, 0 = up, CW)
const CORNER_RADIUS_PCT = 18;   // ← border-radius as % of shorter dimension
const OUTER_PAD_PCT     = 8;    // ← outer rect grows by this % on each side relative to inner

/* ================================================================== */

class PushButton extends HTMLElement {

  static get observedAttributes() { return ["label", "disabled"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pressed = false;
  }

  connectedCallback() {
    this._buildDOM();
    this._addListeners();
  }

  attributeChangedCallback() {
    if (!this._inner) return;
    this._syncLabel();
    this._syncDisabled();
  }

  /* ---- DOM ---- */
  _buildDOM() {
    const gradA = GRAD_ANGLE_DEG;
    const gradB = GRAD_ANGLE_DEG + 180;
    const pad   = OUTER_PAD_PCT;
    const cr    = CORNER_RADIUS_PCT;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          user-select: none;
          -webkit-user-select: none;
        }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }

        .outer {
          background: linear-gradient(${gradA}deg, ${COLORS.neutral1}, ${COLORS.neutral2});
          border-radius: ${cr}%;
          padding: ${pad}% ${pad * 1.5}%;
          cursor: pointer;
          transition: filter 0.12s ease, transform 0.12s ease;
        }
        .outer:active, .outer.pressed {
          filter: brightness(0.85);
          transform: scale(0.97);
        }

        .inner {
          background: linear-gradient(${gradB}deg, ${COLORS.neutral1}, ${COLORS.neutral2});
          border-radius: ${cr}%;
          padding: 10px 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease;
        }
        .outer:active .inner, .outer.pressed .inner {
          background: linear-gradient(${gradA}deg, ${COLORS.neutral1}, ${COLORS.neutral2});
        }

        .label {
          color: ${COLORS.fg};
          font: 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: nowrap;
          pointer-events: none;
        }
      </style>
      <div class="outer">
        <div class="inner">
          <span class="label"></span>
        </div>
      </div>`;

    this._outer = this.shadowRoot.querySelector(".outer");
    this._inner = this.shadowRoot.querySelector(".inner");
    this._labelEl = this.shadowRoot.querySelector(".label");
    this._syncLabel();
    this._syncDisabled();
  }

  _syncLabel() {
    if (this._labelEl) this._labelEl.textContent = this.getAttribute("label") || "";
  }

  _syncDisabled() {
    // handled via :host([disabled]) CSS
  }

  /* ---- interaction ---- */
  _addListeners() {
    this._outer.addEventListener("pointerdown", (e) => {
      if (this.hasAttribute("disabled")) return;
      this._pressed = true;
      this._outer.classList.add("pressed");
      this._outer.setPointerCapture(e.pointerId);
    });

    this._outer.addEventListener("pointerup", () => {
      if (!this._pressed) return;
      this._pressed = false;
      this._outer.classList.remove("pressed");
      this.dispatchEvent(new Event("activate", { bubbles: true }));
    });

    this._outer.addEventListener("pointerleave", () => {
      if (!this._pressed) return;
      this._pressed = false;
      this._outer.classList.remove("pressed");
    });
  }

  /* ---- public API ---- */
  setLabel(text) { this.setAttribute("label", text); }
  getLabel()     { return this.getAttribute("label") || ""; }
}

customElements.define("push-button", PushButton);
