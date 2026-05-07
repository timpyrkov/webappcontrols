import { COLORS, refreshColors } from "../tokens.js";

/* ── Tweakable constants ── */
const BORDER_RADIUS = 6;   // px

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
    document.addEventListener("palette-changed", () => this._buildDOM());
  }

  attributeChangedCallback() {
    if (!this._btn) return;
    this._syncLabel();
    this._syncDisabled();
  }

  /* ---- DOM ---- */
  _buildDOM() {
    refreshColors();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          user-select: none;
          -webkit-user-select: none;
        }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }

        .btn {
          background: ${COLORS.bg};
          color: ${COLORS.fg};
          border: 1px solid ${COLORS.neutral5};
          border-radius: ${BORDER_RADIUS}px;
          padding: var(--btn-padding, 10px 28px);
          cursor: pointer;
          font: 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          white-space: nowrap;
          transition: background 0.12s ease, filter 0.12s ease;
        }
        .btn:hover {
          background: ${COLORS.neutral3};
        }
        .btn:active, .btn.pressed {
          filter: brightness(0.85);
        }
      </style>
      <button class="btn"></button>`;

    this._btn = this.shadowRoot.querySelector(".btn");
    this._syncLabel();
    this._syncDisabled();
  }

  _syncLabel() {
    if (this._btn) this._btn.textContent = this.getAttribute("label") || "";
  }

  _syncDisabled() {
    // handled via :host([disabled]) CSS
  }

  /* ---- interaction ---- */
  _addListeners() {
    this.shadowRoot.addEventListener("pointerdown", (e) => {
      if (this.hasAttribute("disabled")) return;
      this._pressed = true;
      this._btn.classList.add("pressed");
      this._btn.setPointerCapture(e.pointerId);
    });

    this.shadowRoot.addEventListener("pointerup", () => {
      if (!this._pressed) return;
      this._pressed = false;
      this._btn.classList.remove("pressed");
      this.dispatchEvent(new Event("activate", { bubbles: true }));
    });

    this.shadowRoot.addEventListener("pointerleave", () => {
      if (!this._pressed) return;
      this._pressed = false;
      this._btn.classList.remove("pressed");
    });
  }

  /* ---- public API ---- */
  setLabel(text) { this.setAttribute("label", text); }
  getLabel()     { return this.getAttribute("label") || ""; }
}

customElements.define("push-button", PushButton);
