import { COLORS, gradPair, captionAccent } from "../tokens.js";

/* ── Gradient direction (degrees, 0 = up, clockwise) ── */
const GRAD_ANGLE_DEG = 135; // ← tweak this to change gradient direction

/* ── Layout constants (fractions of component size) ── */
const OUTER_R   = 0.30;   // outer circle radius
const INNER_R   = 0.22;   // inner circle radius
const ARC_R     = 0.42;   // value-indicator arc radius (continuous mode)
const ARC_W     = 6;      // arc stroke width (px, before DPR scale)
const PTR_LEN   = 0.07;   // pointer length (fraction of size)
const PTR_OFF   = 0.05;   // pointer offset from inner edge (fraction)
const PTR_W     = 4;      // pointer stroke width (px)
const GAP_DEG   = 20;     // gap at top for continuous arc (half-gap each side)
const LABEL_R   = 0.46;   // enum label radius
const CAPTION_H = 20;     // px reserved at bottom for caption text
const ANIM_MS   = 180;    // animation duration

/* ── Volume-mode layout (fractions of component size) ── */
const VOL_BEZEL_OUTER_R = 0.30;   // outermost edge of pale silver bezel
const VOL_BEZEL_INNER_R = 0.275;  // inner edge of bezel / outer edge of knurl
const VOL_KNURL_OUTER_R = 0.275;  // outer edge of knurled grip ring
const VOL_KNURL_INNER_R = 0.235;  // inner edge of knurled grip ring
const VOL_GROOVE_R      = 0.230;  // recessed groove (darker line) radius
const VOL_CAP_R         = 0.220;  // domed cap radius
const KNURL_TICKS       = 44;     // number of knurl divisions
const VOL_PIVOT_R       = 0.012;  // pivot dot radius

/**
 * Mirror of nicheColors() in gauges.js — returns [rim, depth] colors
 * for theme-aware niche glow effects.
 */
function nicheColors() {
  const isLight = document.documentElement.dataset.theme === "light";
  const rim   = isLight ? "white" : COLORS.neutral4;
  const depth = isLight ? COLORS.neutral12 : COLORS.neutral1;
  return [rim, depth];
}

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
    return ["value", "min", "max", "step", "mode", "values", "label", "disabled", "flat", "volume"];
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
          display: block;
          width: 100%;
          height: 100%;
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

    // Reserve space for caption at bottom; knob is centered in remaining area
    const availH = h - CAPTION_H;
    const S  = Math.min(w, availH);   // reference size
    const cx = w / 2;
    const cy = availH / 2;

    if (this.hasAttribute("volume")) {
      this._drawVolume(ctx, cx, cy, S);
    } else {
      this._drawOuterCircle(ctx, cx, cy, S);
      this._drawInnerCircle(ctx, cx, cy, S);
      this._drawPointer(ctx, cx, cy, S);
    }
    if (this._mode === "continuous") {
      this._drawArcContinuous(ctx, cx, cy, S);
    } else {
      this._drawEnumLabels(ctx, cx, cy, S);
    }
    this._drawCaption(ctx, cx, cy, S, w, h);
  }

  /* -- Volume style: bezel + knurl + groove + domed cap + pointer + pivot -- */
  _drawVolume(ctx, cx, cy, S) {
    const isLight = document.documentElement.dataset.theme === "light";

    /* 1) Outer drop-shadow halo under the bezel */
    ctx.save();
    ctx.shadowColor = isLight ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.55)";
    ctx.shadowBlur = S * 0.04;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = S * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cy, S * VOL_BEZEL_OUTER_R, 0, TAU);
    ctx.fillStyle = isLight ? COLORS.neutral12 : COLORS.neutral1;
    ctx.fill();
    ctx.restore();

    /* 2) Pale outer bezel ring — silver, lit from top-left */
    {
      const rOut = S * VOL_BEZEL_OUTER_R;
      const rIn  = S * VOL_BEZEL_INNER_R;
      const [bezA, bezB] = gradPair(COLORS.neutral9, COLORS.neutral6);
      const grad = ctx.createLinearGradient(
        cx - rOut * 0.7, cy - rOut * 0.7,
        cx + rOut * 0.7, cy + rOut * 0.7
      );
      grad.addColorStop(0, bezA);
      grad.addColorStop(1, bezB);
      ctx.beginPath();
      ctx.arc(cx, cy, rOut, 0, TAU);
      ctx.arc(cx, cy, rIn,  0, TAU, true);
      ctx.fillStyle = grad;
      ctx.fill("evenodd");
    }

    /* 3) Knurled grip ring — alternating thin radial slices */
    {
      const rOut = S * VOL_KNURL_OUTER_R;
      const rIn  = S * VOL_KNURL_INNER_R;
      // Base fill (dark)
      ctx.beginPath();
      ctx.arc(cx, cy, rOut, 0, TAU);
      ctx.arc(cx, cy, rIn,  0, TAU, true);
      const [baseA, baseB] = gradPair(COLORS.neutral4, COLORS.neutral2);
      const baseGrad = ctx.createLinearGradient(
        cx, cy - rOut, cx, cy + rOut
      );
      baseGrad.addColorStop(0, baseA);
      baseGrad.addColorStop(1, baseB);
      ctx.fillStyle = baseGrad;
      ctx.fill("evenodd");

      // Knurl ticks — thin alternating lighter/darker radial slices
      const [hiA, hiB] = gradPair(COLORS.neutral6, COLORS.neutral3);
      const [loA, loB] = gradPair(COLORS.neutral2, COLORS.neutral1);
      const tickW = TAU / KNURL_TICKS;
      const halfW = tickW * 0.42;  // gap between ridges
      for (let i = 0; i < KNURL_TICKS; i++) {
        const ang = i * tickW;
        const isHi = (i % 2) === 0;
        // skew lighting so ridges at top look brighter, ridges at bottom darker
        const lighting = Math.cos(ang - Math.PI / 2);  // +1 at bottom, -1 at top
        const tintT = (lighting + 1) * 0.5;            // 0..1
        const cTop = isHi ? hiA : loA;
        const cBot = isHi ? hiB : loB;
        const c = lerpColor(cTop, cBot, tintT);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rOut, ang - halfW - Math.PI / 2, ang + halfW - Math.PI / 2);
        ctx.closePath();
        // Mask to the knurl annulus by clipping with the inner hole
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.arc(cx, cy, rOut, 0, TAU);
        ctx.arc(cx, cy, rIn,  0, TAU, true);
        ctx.fillStyle = c;
        ctx.fill("evenodd");
        ctx.restore();
      }
    }

    /* 4) Recessed groove shadow — thin darker ring */
    {
      const r = S * VOL_GROOVE_R;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.strokeStyle = isLight ? COLORS.neutral8 : COLORS.neutral1;
      ctx.lineWidth = Math.max(1, S * 0.006);
      ctx.stroke();
    }

    /* 5) Domed cap — radial gradient (light at top, dark at bottom-center) */
    {
      const r = S * VOL_CAP_R;
      const [capLight, capDark] = gradPair(COLORS.neutral3, COLORS.neutral1);
      const grad = ctx.createRadialGradient(
        cx, cy - r * 0.45, r * 0.05,
        cx, cy + r * 0.10, r * 1.1
      );
      grad.addColorStop(0, capLight);
      grad.addColorStop(1, capDark);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle inner-rim highlight at top (suggests convex dome)
      const [rim] = nicheColors();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.strokeStyle = rim;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = Math.max(1, S * 0.006);
      ctx.stroke();
      ctx.restore();
    }

    /* 6) Pointer line — accent-3 → accent-1 gradient */
    {
      const innerR = S * VOL_CAP_R;
      const ang = this._displayAngle;
      const rStart = innerR - S * PTR_LEN - S * PTR_OFF;
      const rEnd   = innerR - S * PTR_OFF;
      const sinA = Math.sin(ang), cosA = -Math.cos(ang);
      const x1 = cx + sinA * rStart, y1 = cy + cosA * rStart;
      const x2 = cx + sinA * rEnd,   y2 = cy + cosA * rEnd;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, COLORS.accent3);
      g.addColorStop(1, COLORS.accent1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = g;
      ctx.lineWidth = PTR_W;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    /* 7) Pivot dot at cap center */
    {
      const pr = Math.max(1.5, S * VOL_PIVOT_R);
      ctx.beginPath();
      ctx.arc(cx, cy, pr, 0, TAU);
      ctx.fillStyle = COLORS.accent1;
      ctx.fill();
    }
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
      ctx.fillStyle = COLORS.neutral5;
    } else {
      const [oTop, oBot] = gradPair(COLORS.neutral5, COLORS.neutral3);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG, oTop, oBot);
    }
    ctx.fill();
    if (!this.hasAttribute("flat")) {
      ctx.strokeStyle = COLORS.edge2;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* -- inner circle -- */
  _drawInnerCircle(ctx, cx, cy, S) {
    const r = S * INNER_R;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    if (this.hasAttribute("flat")) {
      ctx.fillStyle = COLORS.neutral3;
    } else {
      const [iTop, iBot] = gradPair(COLORS.neutral5, COLORS.neutral3);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG + 180, iTop, iBot);
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
      style = COLORS.accent1;
    } else {
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, COLORS.accent3);
      g.addColorStop(1, COLORS.accent1);
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
    ctx.strokeStyle = COLORS.neutral5;
    ctx.lineWidth   = ARC_W;
    ctx.lineCap     = "round";
    ctx.stroke();

    // foreground accent arc
    const endAngle = this._displayAngle;
    if (endAngle <= gap + 0.001) return;          // nothing to draw

    // Gradient arc: accent1 at zero, accent2 at max (full track range)
    const fullSpan = TAU - 2 * gap;
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
      const midAngle = startA + ((t0 + t1) / 2) * spanA;
      const gradT = (midAngle - gap) / fullSpan;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.strokeStyle = lerpColor(COLORS.accent1, COLORS.accent5, gradT);
      ctx.stroke();
    }
  }

  /* -- enum labels -- */
  _drawEnumLabels(ctx, cx, cy, S) {
    const n = this._enumValues.length;
    if (n === 0) return;
    const r = S * LABEL_R;
    const currentIdx = typeof this._value === "number" ? this._value : 0;
    const ff = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
    const fontBase = `11px ${ff}`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;                 // 0=top, CW
      const x = cx + Math.sin(a) * r;
      const y = cy - Math.cos(a) * r;
      const label = String(this._enumValues[i]).slice(0, 3);
      const isCurrent = (i === currentIdx);
      ctx.font = isCurrent ? `bold ${fontBase}` : fontBase;
      ctx.fillStyle = isCurrent ? captionAccent() : COLORS.accent5;
      ctx.fillText(label, x, y);
    }
  }

  /* -- title & value caption -- */
  _drawCaption(ctx, cx, cy, S, w, h) {
    const baseY = h - CAPTION_H + 4;
    const ff = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
    const font = `13px ${ff}`;
    ctx.textBaseline = "top";
    ctx.font = font;
    const centerX = w / 2;

    let displayVal;
    if (this._mode === "enum") {
      displayVal = this._enumValues[this._value] ?? "";
    } else {
      displayVal = String(Math.round(this._value));
    }

    // Reference value = widest possible string, used to keep layout stable
    let refVal;
    if (this._mode === "enum") {
      refVal = this._enumValues.reduce((a, b) => String(b).length > String(a).length ? b : a, "");
      refVal = String(refVal);
    } else {
      const sMin = String(Math.round(this._min));
      const sMax = String(Math.round(this._max));
      refVal = sMin.length >= sMax.length ? sMin : sMax;
    }

    if (!this._label) {
      // Centre based on reference value width, then left-align actual value
      const refW = ctx.measureText(refVal).width;
      const valX = centerX - refW / 2;
      ctx.fillStyle = captionAccent();
      ctx.textAlign = "left";
      ctx.fillText(displayVal, valX, baseY);
      return;
    }

    const colonStr = " : ";
    const titleW   = ctx.measureText(this._label).width;
    const colonW   = ctx.measureText(colonStr).width;
    const refW     = ctx.measureText(refVal).width;
    const totalW   = titleW + colonW + refW;
    let x = centerX - totalW / 2;

    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.fg;
    ctx.fillText(this._label, x, baseY);
    x += titleW;

    ctx.fillText(colonStr, x, baseY);
    x += colonW;

    ctx.fillStyle = captionAccent();
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
