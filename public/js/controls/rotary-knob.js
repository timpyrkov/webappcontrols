import { COLORS } from "../tokens.js";

/* ── Gradient direction (degrees, 0 = up, clockwise) ── */
const GRAD_ANGLE_DEG = 135; // ← tweak this to change gradient direction

/* ── Layout constants (fractions of component size) ── */
const OUTER_R   = 0.38;   // outer circle radius
const INNER_R   = 0.28;   // inner circle radius
const ARC_R     = 0.44;   // value-indicator arc radius
const ARC_W     = 6;      // arc stroke width (px, before DPR scale)
const PTR_LEN   = 0.08;   // pointer length (fraction of size)
const PTR_OFF   = 0.04;   // pointer offset from inner edge (fraction)
const PTR_W     = 4;      // pointer stroke width (px)
const GAP_DEG   = 20;     // gap at top for continuous arc (half-gap each side)
const LABEL_R   = 0.50;   // enum label radius (increased for clearance)
const ANIM_MS   = 180;    // animation duration

/* ── Helpers ── */
const DEG  = Math.PI / 180;
const TAU  = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function lerpColor(hex1, hex2, t) {
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  return rgbToHex(a.map((v, i) => Math.round(v + (b[i] - v) * t)));
}

/** Convert a value-angle (0 = top, CW, radians) to canvas angle (0 = right). */
function valAngle(rad) { return rad - Math.PI / 2; }

/* ================================================================== */

class RotaryKnob extends HTMLElement {

  /* ---- observed attributes ---- */
  static get observedAttributes() {
    return ["value", "min", "max", "step", "mode", "values", "label", "disabled", "flat"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /* internal state */
    this._value      = 0;
    this._min        = 0;
    this._max        = 100;
    this._step        = 1;
    this._mode        = "continuous";  // "continuous" | "enum"
    this._enumValues  = [];
    this._label       = "";

    /* animation */
    this._displayAngle = 0;   // current rendered angle (radians, 0 = top CW)
    this._targetAngle  = 0;
    this._animStart    = null;
    this._animFrom     = 0;
    this._rafId        = null;

    /* interaction */
    this._dragging = false;
  }

  /* ---- lifecycle ---- */
  connectedCallback() {
    this._buildDOM();
    this._readAttributes();
    this._resize();
    this._setTargetAngle(this._valueToAngle(this._value), true);
    this._addListeners();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener("resize", this._onResize);
  }

  attributeChangedCallback(name, _old, val) {
    if (!this._canvas) return;
    this._readAttributes();
    this._setTargetAngle(this._valueToAngle(this._value), false);
  }

  /* ---- DOM ---- */
  _buildDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          width: 180px;
          height: 220px;
          user-select: none;
          -webkit-user-select: none;
        }
        :host([disabled]) {
          opacity: 0.38;
          pointer-events: none;
        }
        .wrap { position: relative; width: 100%; height: 100%; }
        canvas { display: block; width: 100%; height: 100%; }
      </style>
      <div class="wrap"><canvas></canvas></div>`;
    this._canvas = this.shadowRoot.querySelector("canvas");
    this._ctx    = this._canvas.getContext("2d");
  }

  /* ---- attribute parsing ---- */
  _readAttributes() {
    this._mode  = this.getAttribute("mode") || "continuous";
    this._label = this.getAttribute("label") || "";
    this._min   = parseFloat(this.getAttribute("min") ?? 0);
    this._max   = parseFloat(this.getAttribute("max") ?? 100);
    this._step  = parseFloat(this.getAttribute("step") ?? 1);

    const raw = this.getAttribute("values");
    if (raw) {
      try { this._enumValues = JSON.parse(raw); }
      catch { this._enumValues = raw.split(",").map(s => s.trim()); }
    }

    const v = this.getAttribute("value");
    if (v !== null) {
      if (this._mode === "enum") {
        const idx = parseInt(v, 10);
        this._value = isNaN(idx) ? 0 : Math.max(0, Math.min(idx, this._enumValues.length - 1));
      } else {
        this._value = Math.max(this._min, Math.min(parseFloat(v), this._max));
      }
    }
  }

  /* ---- sizing (HiDPI) ---- */
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._w = rect.width;
    this._h = rect.height;
    this._canvas.width  = rect.width  * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._draw();
  }

  /* ---- value <-> angle mapping ---- */

  /** Returns angle in radians (0 = top, CW) for a given value. */
  _valueToAngle(v) {
    if (this._mode === "enum") {
      const n = this._enumValues.length;
      if (n === 0) return 0;
      const idx = typeof v === "number" ? v : 0;
      return (idx / n) * TAU;
    }
    const gap = GAP_DEG * DEG;              // half-gap in radians
    const span = TAU - gap * 2;             // usable arc
    const alpha = (v - this._min) / (this._max - this._min);
    return gap + alpha * span;
  }

  /** Returns value for a given angle (radians, 0 = top, CW, 0..TAU). */
  _angleToValue(a) {
    // normalise to 0..TAU
    a = ((a % TAU) + TAU) % TAU;
    if (this._mode === "enum") {
      const n = this._enumValues.length;
      if (n === 0) return 0;
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < n; i++) {
        const ea = (i / n) * TAU;
        let d = Math.abs(a - ea);
        if (d > Math.PI) d = TAU - d;
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    }
    const gap  = GAP_DEG * DEG;
    const span = TAU - gap * 2;
    let alpha = (a - gap) / span;
    alpha = Math.max(0, Math.min(1, alpha));
    let v = this._min + alpha * (this._max - this._min);
    v = Math.round(v / this._step) * this._step;
    return Math.max(this._min, Math.min(v, this._max));
  }

  /* ---- animation ---- */
  _setTargetAngle(angle, immediate) {
    this._targetAngle = angle;
    if (immediate) {
      this._displayAngle = angle;
      this._draw();
      return;
    }
    this._animFrom  = this._displayAngle;
    this._animStart = performance.now();
    if (!this._rafId) this._tick();
  }

  _tick() {
    const now = performance.now();
    const t = Math.min(1, (now - this._animStart) / ANIM_MS);
    const ease = 1 - Math.pow(1 - t, 3);  // ease-out cubic
    this._displayAngle = this._animFrom + (this._targetAngle - this._animFrom) * ease;
    this._draw();
    if (t < 1) {
      this._rafId = requestAnimationFrame(() => this._tick());
    } else {
      this._rafId = null;
    }
  }

  /* ================================================================ */
  /*  DRAWING                                                         */
  /* ================================================================ */
  _draw() {
    const ctx = this._ctx;
    const w = this._w, h = this._h;
    ctx.clearRect(0, 0, w, h);

    // Centre of knob area (leave room below for label)
    const knobSize = Math.min(w, h - 36);
    const cx = w / 2;
    const cy = knobSize / 2 + 4;
    const S  = knobSize;   // reference size

    this._drawOuterCircle(ctx, cx, cy, S);
    this._drawInnerCircle(ctx, cx, cy, S);
    if (this._mode === "continuous") {
      this._drawArcContinuous(ctx, cx, cy, S);
    } else {
      this._drawEnumLabels(ctx, cx, cy, S);
    }
    this._drawPointer(ctx, cx, cy, S);
    this._drawCaption(ctx, cx, cy, S, w, h);
  }

  /* -- gradient helper -- */
  _makeLinGrad(ctx, cx, cy, r, angleDeg, c1, c2) {
    const a = angleDeg * DEG;
    const dx = Math.sin(a) * r;
    const dy = -Math.cos(a) * r;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    return g;
  }

  /* -- outer circle -- */
  _drawOuterCircle(ctx, cx, cy, S) {
    const r = S * OUTER_R;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    if (this.hasAttribute("flat")) {
      ctx.fillStyle = COLORS.neutral1;
    } else {
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG, COLORS.neutral1, COLORS.neutral2);
    }
    ctx.fill();
  }

  /* -- inner circle -- */
  _drawInnerCircle(ctx, cx, cy, S) {
    const r = S * INNER_R;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    if (this.hasAttribute("flat")) {
      ctx.fillStyle = COLORS.neutral2;
    } else {
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG + 180, COLORS.neutral1, COLORS.neutral2);
    }
    ctx.fill();
  }

  /* -- pointer segment -- */
  _drawPointer(ctx, cx, cy, S) {
    const innerR = S * INNER_R;
    const ang = this._displayAngle;             // 0=top, CW
    const rStart = innerR - S * PTR_LEN - S * PTR_OFF;
    const rEnd   = innerR - S * PTR_OFF;
    const sinA = Math.sin(ang), cosA = -Math.cos(ang);
    const x1 = cx + sinA * rStart, y1 = cy + cosA * rStart;
    const x2 = cx + sinA * rEnd,   y2 = cy + cosA * rEnd;

    let style;
    if (this.hasAttribute("flat")) {
      style = COLORS.accent2;
    } else {
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, COLORS.accent1);
      g.addColorStop(1, COLORS.accent2);
      style = g;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = style;
    ctx.lineWidth   = PTR_W;
    ctx.lineCap     = "round";
    ctx.stroke();
  }

  /* -- continuous arc indicators -- */
  _drawArcContinuous(ctx, cx, cy, S) {
    const r   = S * ARC_R;
    const gap = GAP_DEG * DEG;

    // background arc (neutral-2) — full range with gap at top
    ctx.beginPath();
    ctx.arc(cx, cy, r, valAngle(gap), valAngle(TAU - gap));
    ctx.strokeStyle = COLORS.neutral2;
    ctx.lineWidth   = ARC_W;
    ctx.lineCap     = "round";
    ctx.stroke();

    // foreground accent arc
    const endAngle = this._displayAngle;
    if (endAngle <= gap + 0.001) return;          // nothing to draw

    if (this.hasAttribute("flat")) {
      // Flat mode: single solid colour arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, valAngle(gap), valAngle(endAngle));
      ctx.strokeStyle = COLORS.accent2;
      ctx.lineWidth = ARC_W;
      ctx.lineCap = "round";
      ctx.stroke();
    } else {
      // Gradient mode: conical-approximated gradient with many tiny arcs
      const alpha = (endAngle - gap) / (TAU - 2 * gap);
      const endColor = lerpColor(COLORS.accent2, COLORS.accent1, alpha);
      const steps = 60;
      const startA = gap;
      const spanA  = endAngle - gap;
      ctx.lineWidth = ARC_W;
      ctx.lineCap   = "round";
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        if (t1 * spanA + startA > endAngle + 0.001) break;
        const a0 = valAngle(startA + t0 * spanA);
        const a1 = valAngle(startA + t1 * spanA);
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1);
        ctx.strokeStyle = lerpColor(COLORS.accent2, endColor, (t0 + t1) / 2);
        ctx.stroke();
      }
    }
  }

  /* -- enum labels -- */
  _drawEnumLabels(ctx, cx, cy, S) {
    const n = this._enumValues.length;
    if (n === 0) return;
    const r = S * LABEL_R;
    const currentIdx = typeof this._value === "number" ? this._value : 0;
    const fontBase = `11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;                 // 0=top, CW
      const x = cx + Math.sin(a) * r;
      const y = cy - Math.cos(a) * r;
      const label = String(this._enumValues[i]).slice(0, 3);
      const isCurrent = (i === currentIdx);
      ctx.font = isCurrent ? `bold ${fontBase}` : fontBase;
      ctx.fillStyle = isCurrent ? COLORS.accent2 : COLORS.accent1;
      ctx.fillText(label, x, y);
    }
  }

  /* -- title & value caption -- */
  _drawCaption(ctx, cx, cy, S, w, h) {
    const baseY = cy + S * OUTER_R + 32;
    const font = `13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = "top";
    ctx.font = font;
    const centerX = w / 2;  // always use canvas horizontal centre

    let displayVal;
    if (this._mode === "enum") {
      displayVal = this._enumValues[this._value] ?? "";
    } else {
      displayVal = String(Math.round(this._value));
    }

    if (!this._label) {
      ctx.fillStyle = COLORS.accent2;
      ctx.textAlign = "center";
      ctx.fillText(displayVal, centerX, baseY);
      ctx.textAlign = "left";
      return;
    }

    const colonStr = " : ";
    const titleW   = ctx.measureText(this._label).width;
    const colonW   = ctx.measureText(colonStr).width;
    const valW     = ctx.measureText(displayVal).width;
    const totalW   = titleW + colonW + valW;
    let x = centerX - totalW / 2;

    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.fg;
    ctx.fillText(this._label, x, baseY);
    x += titleW;

    ctx.fillText(colonStr, x, baseY);
    x += colonW;

    ctx.fillStyle = COLORS.accent2;
    ctx.fillText(displayVal, x, baseY);
  }

  /* ================================================================ */
  /*  INTERACTION                                                     */
  /* ================================================================ */
  _addListeners() {
    const el = this._canvas;
    el.addEventListener("pointerdown", (e) => this._onDown(e));
    el.addEventListener("pointermove", (e) => this._onMove(e));
    el.addEventListener("pointerup",   (e) => this._onUp(e));
    el.addEventListener("pointerleave",(e) => this._onUp(e));

    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
  }

  _pointerAngle(e) {
    const rect = this._canvas.getBoundingClientRect();
    const knobSize = Math.min(this._w, this._h - 36);
    const cx = this._w / 2;
    const cy = knobSize / 2 + 4;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let a = Math.atan2(px - cx, -(py - cy));  // 0=top, CW
    if (a < 0) a += TAU;
    return a;
  }

  _applyAngle(a) {
    const v = this._angleToValue(a);
    if (v === this._value) return;
    this._value = v;
    this.setAttribute("value", this._mode === "enum" ? v : v);
    this._setTargetAngle(this._valueToAngle(v), false);
    this.dispatchEvent(new Event("input", { bubbles: true }));
  }

  _onDown(e) {
    if (this.hasAttribute("disabled")) return;
    this._dragging = true;
    this._canvas.setPointerCapture(e.pointerId);
    this._applyAngle(this._pointerAngle(e));
  }

  _onMove(e) {
    if (!this._dragging) return;
    this._applyAngle(this._pointerAngle(e));
  }

  _onUp(e) {
    if (!this._dragging) return;
    this._dragging = false;
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ---- public API ---- */
  getValue() { return this._mode === "enum" ? this._enumValues[this._value] : this._value; }

  setValue(v) {
    if (this._mode === "enum") {
      const idx = this._enumValues.indexOf(v);
      if (idx >= 0) { this._value = idx; }
    } else {
      this._value = Math.max(this._min, Math.min(parseFloat(v), this._max));
    }
    this._setTargetAngle(this._valueToAngle(this._value), false);
    this._draw();
  }
}

customElements.define("rotary-knob", RotaryKnob);
