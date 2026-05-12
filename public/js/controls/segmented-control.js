import { COLORS, refreshColors } from "../tokens.js";

/* ── Tweakable constants ── */
const BORDER_RADIUS = 6;   // px outer border-radius

/* ================================================================== */

class SegmentedControl extends HTMLElement {

  static get observedAttributes() { return ["values", "keys", "value", "columns", "disabled"]; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._values  = [];
    this._keys    = null;   // optional: stable keys parallel to values
    this._value   = "";     // current selected key (or display value if no keys)
    this._columns = 4;
  }

  connectedCallback() {
    this._readAttributes();
    this._buildDOM();
    document.addEventListener("palette-changed", () => this._buildDOM());
  }

  attributeChangedCallback() {
    this._readAttributes();
    if (this.shadowRoot.querySelector(".grid")) this._buildDOM();
  }

  _readAttributes() {
    const prevIndex = this._keys
      ? this._keys.indexOf(this._value)
      : this._values.indexOf(this._value);
    const raw = this.getAttribute("values");
    if (raw) {
      try { this._values = JSON.parse(raw); }
      catch { this._values = raw.split(",").map(s => s.trim()); }
    }
    const keysRaw = this.getAttribute("keys");
    if (keysRaw) {
      try { this._keys = JSON.parse(keysRaw); }
      catch { this._keys = null; }
    } else {
      this._keys = null;
    }
    const attrVal = this.getAttribute("value");
    if (this._keys) {
      this._value = attrVal || this._keys[0] || "";
    } else {
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

  _keyForIndex(i) { return this._keys ? this._keys[i] : this._values[i]; }
  _selectedIndex() {
    if (this._keys) return this._keys.indexOf(this._value);
    return this._values.indexOf(this._value);
  }

  /* ---- DOM ---- */
  _buildDOM() {
    refreshColors();
    const cols = this._columns;
    const borderColor = COLORS.neutral5;
    const bgColor = COLORS.bg;
    const fgColor = COLORS.fg;
    const selBg = COLORS.fg;
    const selFg = COLORS.bg;

    const selIdx = this._selectedIndex();
    const segmentItems = this._values.map((v, i) => {
      const selected = i === selIdx;
      return `<div class="cell${selected ? " selected" : ""}" data-idx="${i}">
          <span>${v}</span>
        </div>`;
    }).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          user-select: none;
          -webkit-user-select: none;
        }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }

        .grid {
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          border: 1px solid ${borderColor};
          border-radius: ${BORDER_RADIUS}px;
          overflow: hidden;
          background: ${borderColor};
          gap: 1px;
        }
        .cell {
          background: ${bgColor};
          padding: var(--seg-padding, 8px 14px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .cell:active {
          filter: brightness(0.85);
        }
        .cell.selected {
          background: ${selBg};
        }
        .cell span {
          font: var(--seg-font-size, 13px)/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: ${fgColor};
          white-space: nowrap;
          pointer-events: none;
        }
        .cell.selected span {
          color: ${selFg};
          font-weight: 600;
        }
      </style>
      <div class="grid">${segmentItems}</div>`;

    // Click handlers
    this.shadowRoot.querySelectorAll(".cell").forEach((el) => {
      el.addEventListener("pointerup", () => {
        const idx = parseInt(el.dataset.idx, 10);
        const key = this._keyForIndex(idx);
        if (key === this._value) return;
        this._value = key;
        this.setAttribute("value", key);
        this._buildDOM();
        this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: key } }));
      });
    });
  }

  /* ---- public API ---- */
  getValue() { return this._value; }
  setValue(v) {
    const validKeys = this._keys || this._values;
    if (validKeys.includes(v)) {
      this._value = v;
      this.setAttribute("value", v);
      this._buildDOM();
    }
  }
}

customElements.define("segmented-control", SegmentedControl);
