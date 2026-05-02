/**
 * gauges.js — Circular & Linear gauge web components.
 *
 * Both gauges feature:
 * - Adjustable scale (start/end values, segments, direction)
 * - Segmented gradient-coloured scale
 * - Accent-coloured hand with smooth animation
 * - Optional increasing segment thickness
 * - Centered caption: "Label : Value"
 */

import { COLORS, refreshColors } from "../tokens.js";

/* ── Shared constants ── */
const DEG  = Math.PI / 180;
const TAU  = Math.PI * 2;
const ANIM_MS = 220;

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

/* ================================================================
   <circular-gauge>
   ================================================================

   Attributes:
     value          — current value (animated)
     min, max       — scale range
     start-angle    — scale start in degrees (0 = top, CW, default 225 → 7-o'clock)
     end-angle      — scale end   in degrees (default 315 → 5-o'clock → 270° sweep)
     direction      — "cw" (default) | "ccw"
     segments       — number of scale segments (default 10)
     grow-segments  — if present, segment thickness grows with value
     label          — caption label
     flat           — solid fills instead of gradients
*/

const CG_OUTER_R  = 0.42;
const CG_ARC_R    = 0.42;
const CG_ARC_W    = 8;
const CG_HAND_R   = 0.36;
const CG_HUB_R    = 0.06;
const CG_HAND_W   = 3;
const CG_GAP_FRAC = 0.25;   // gap between segments as fraction of segment angular span

class CircularGauge extends HTMLElement {

  static get observedAttributes() {
    return ["value", "min", "max", "start-angle", "end-angle",
            "direction", "segments", "grow-segments", "label", "flat"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._value = 0; this._min = 0; this._max = 100;
    this._startAngle = 225; this._endAngle = 135;
    this._direction = "cw"; this._segments = 10;
    this._growSegments = false; this._label = "";
    this._displayAngle = 0; this._targetAngle = 0;
    this._animStart = null; this._animFrom = 0; this._rafId = null;
  }

  connectedCallback() {
    this._buildDOM();
    this._readAttributes();
    this._resize();
    this._setTargetAngle(this._valueToAngle(this._value), true);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener("resize", this._onResize);
  }

  attributeChangedCallback() {
    if (!this._canvas) return;
    this._readAttributes();
    this._setTargetAngle(this._valueToAngle(this._value), false);
  }

  _buildDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%; height: 100%;
          user-select: none; -webkit-user-select: none;
        }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }
        .wrap { position: relative; width: 100%; height: 100%; }
        canvas { display: block; width: 100%; height: 100%; }
      </style>
      <div class="wrap"><canvas></canvas></div>`;
    this._canvas = this.shadowRoot.querySelector("canvas");
    this._ctx    = this._canvas.getContext("2d");
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
  }

  _readAttributes() {
    this._min        = parseFloat(this.getAttribute("min") ?? 0);
    this._max        = parseFloat(this.getAttribute("max") ?? 100);
    this._value      = Math.max(this._min, Math.min(parseFloat(this.getAttribute("value") ?? 0), this._max));
    this._startAngle = parseFloat(this.getAttribute("start-angle") ?? 225);
    this._endAngle   = parseFloat(this.getAttribute("end-angle") ?? 135);
    this._direction  = this.getAttribute("direction") || "cw";
    this._segments   = parseInt(this.getAttribute("segments") ?? 10, 10);
    this._growSegments = this.hasAttribute("grow-segments");
    this._label      = this.getAttribute("label") || "";
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._w = rect.width; this._h = rect.height;
    this._canvas.width  = rect.width  * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._draw();
  }

  /* ── angle helpers ── */
  // All angles stored internally as radians, 0 = right (canvas convention)
  _degToCanvasRad(deg) { return (deg - 90) * DEG; }

  _sweepRad() {
    let sweep = this._endAngle - this._startAngle;
    if (this._direction === "cw") {
      if (sweep <= 0) sweep += 360;
    } else {
      if (sweep >= 0) sweep -= 360;
    }
    return sweep * DEG;
  }

  _valueToAngle(v) {
    const frac = (v - this._min) / (this._max - this._min);
    return this._degToCanvasRad(this._startAngle) + frac * this._sweepRad();
  }

  /* ── animation ── */
  _setTargetAngle(angle, immediate) {
    this._targetAngle = angle;
    if (immediate) { this._displayAngle = angle; this._draw(); return; }
    this._animFrom = this._displayAngle;
    this._animStart = performance.now();
    if (!this._rafId) this._tick();
  }

  _tick() {
    const t = Math.min(1, (performance.now() - this._animStart) / ANIM_MS);
    const ease = 1 - Math.pow(1 - t, 3);
    this._displayAngle = this._animFrom + (this._targetAngle - this._animFrom) * ease;
    this._draw();
    if (t < 1) this._rafId = requestAnimationFrame(() => this._tick());
    else this._rafId = null;
  }

  /* ── drawing ── */
  _draw() {
    const ctx = this._ctx;
    const w = this._w, h = this._h;
    ctx.clearRect(0, 0, w, h);
    const gaugeSize = Math.min(w, h - 32);
    const cx = w / 2;
    const cy = gaugeSize / 2 + 4;
    const S = gaugeSize;

    this._drawSegments(ctx, cx, cy, S);
    this._drawHand(ctx, cx, cy, S);
    this._drawHub(ctx, cx, cy, S);
    this._drawCaption(ctx, w, h, cy, S);
  }

  _drawSegments(ctx, cx, cy, S) {
    const r = S * CG_ARC_R;
    const n = this._segments;
    const sweep = this._sweepRad();
    const startRad = this._degToCanvasRad(this._startAngle);
    const segSpan = sweep / n;
    const gapRad = Math.abs(segSpan) * CG_GAP_FRAC;
    const baseW = CG_ARC_W;

    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const color = lerpColor(COLORS.accent1, COLORS.accent2, t);
      const a0 = startRad + i * segSpan + (this._direction === "cw" ? gapRad / 2 : -gapRad / 2);
      const a1 = startRad + (i + 1) * segSpan - (this._direction === "cw" ? gapRad / 2 : -gapRad / 2);
      const lw = this._growSegments ? baseW * (0.5 + (n > 1 ? i / (n - 1) : 1) * 1.0) : baseW;

      ctx.beginPath();
      if (this._direction === "cw") ctx.arc(cx, cy, r, a0, a1);
      else ctx.arc(cx, cy, r, a0, a1, true);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = "butt";
      ctx.stroke();
    }
  }

  _drawHand(ctx, cx, cy, S) {
    const handR = S * CG_HAND_R;
    const ang = this._displayAngle;
    const x = cx + Math.cos(ang) * handR;
    const y = cy + Math.sin(ang) * handR;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = COLORS.accent2;
    ctx.lineWidth = CG_HAND_W;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  _drawHub(ctx, cx, cy, S) {
    const r = S * CG_HUB_R;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = COLORS.neutral2;
    ctx.fill();
  }

  _drawCaption(ctx, w, h, cy, S) {
    const baseY = cy + S * CG_ARC_R + 20;
    const ff = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
    const font = `13px ${ff}`;
    ctx.textBaseline = "top";
    ctx.font = font;
    const centerX = w / 2;
    const displayVal = String(Math.round(this._value));

    if (!this._label) {
      ctx.fillStyle = COLORS.accent2;
      ctx.textAlign = "center";
      ctx.fillText(displayVal, centerX, baseY);
      ctx.textAlign = "left";
      return;
    }

    const colonStr = " : ";
    const titleW  = ctx.measureText(this._label).width;
    const colonW  = ctx.measureText(colonStr).width;
    const valW    = ctx.measureText(displayVal).width;
    const totalW  = titleW + colonW + valW;
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

  setValue(v) {
    this._value = Math.max(this._min, Math.min(parseFloat(v), this._max));
    this.setAttribute("value", this._value);
  }
  getValue() { return this._value; }
}


/* ================================================================
   <linear-gauge>
   ================================================================

   Attributes:
     value          — current value (animated)
     min, max       — scale range
     size           — CSS length for the main axis (default "200px")
     direction      — "horizontal" (default) | "vertical"
     segments       — number of scale segments (default 10)
     grow-segments  — if present, segment thickness grows with value
     label          — caption label
     flat           — (reserved for future use)
*/

const LG_TRACK_W   = 8;
const LG_GAP_FRAC  = 0.20;
const LG_HAND_W    = 3;
const LG_HAND_OVER = 6; // hand overshoot past track edges (px)

class LinearGauge extends HTMLElement {

  static get observedAttributes() {
    return ["value", "min", "max", "size", "direction",
            "segments", "grow-segments", "label", "flat"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._value = 0; this._min = 0; this._max = 100;
    this._direction = "horizontal"; this._segments = 10;
    this._growSegments = false; this._label = "";
    this._displayFrac = 0; this._targetFrac = 0;
    this._animStart = null; this._animFrom = 0; this._rafId = null;
  }

  connectedCallback() {
    this._buildDOM();
    this._readAttributes();
    this._resize();
    this._setTargetFrac(this._valueFrac(), true);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener("resize", this._onResize);
  }

  attributeChangedCallback() {
    if (!this._canvas) return;
    this._readAttributes();
    this._setTargetFrac(this._valueFrac(), false);
  }

  _buildDOM() {
    const dir = this.getAttribute("direction") || "horizontal";
    const isVert = dir === "vertical";
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%; height: 100%;
          user-select: none; -webkit-user-select: none;
        }
        :host([disabled]) { opacity: 0.38; pointer-events: none; }
        .wrap { position: relative; width: 100%; height: 100%; }
        canvas { display: block; width: 100%; height: 100%; }
      </style>
      <div class="wrap"><canvas></canvas></div>`;
    this._canvas = this.shadowRoot.querySelector("canvas");
    this._ctx    = this._canvas.getContext("2d");
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);
  }

  _readAttributes() {
    this._min = parseFloat(this.getAttribute("min") ?? 0);
    this._max = parseFloat(this.getAttribute("max") ?? 100);
    this._value = Math.max(this._min, Math.min(parseFloat(this.getAttribute("value") ?? 0), this._max));
    this._direction = this.getAttribute("direction") || "horizontal";
    this._segments = parseInt(this.getAttribute("segments") ?? 10, 10);
    this._growSegments = this.hasAttribute("grow-segments");
    this._label = this.getAttribute("label") || "";
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._w = rect.width; this._h = rect.height;
    this._canvas.width  = rect.width  * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._draw();
  }

  _valueFrac() {
    return (this._value - this._min) / (this._max - this._min);
  }

  /* ── animation ── */
  _setTargetFrac(frac, immediate) {
    this._targetFrac = frac;
    if (immediate) { this._displayFrac = frac; this._draw(); return; }
    this._animFrom = this._displayFrac;
    this._animStart = performance.now();
    if (!this._rafId) this._tick();
  }

  _tick() {
    const t = Math.min(1, (performance.now() - this._animStart) / ANIM_MS);
    const ease = 1 - Math.pow(1 - t, 3);
    this._displayFrac = this._animFrom + (this._targetFrac - this._animFrom) * ease;
    this._draw();
    if (t < 1) this._rafId = requestAnimationFrame(() => this._tick());
    else this._rafId = null;
  }

  /* ── drawing ── */
  _draw() {
    const ctx = this._ctx;
    const w = this._w, h = this._h;
    ctx.clearRect(0, 0, w, h);
    const isVert = this._direction === "vertical";
    if (isVert) this._drawVertical(ctx, w, h);
    else this._drawHorizontal(ctx, w, h);
  }

  _drawHorizontal(ctx, w, h) {
    const n = this._segments;
    const captionH = this._label ? 22 : 0;
    const trackY = (h - captionH) / 2;
    const padX = 10;
    const trackLen = w - padX * 2;
    const segLen = trackLen / n;
    const gapPx = segLen * LG_GAP_FRAC;
    const baseW = LG_TRACK_W;

    // segments
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const color = lerpColor(COLORS.accent1, COLORS.accent2, t);
      const x0 = padX + i * segLen + gapPx / 2;
      const x1 = padX + (i + 1) * segLen - gapPx / 2;
      const lw = this._growSegments ? baseW * (0.5 + (n > 1 ? i / (n - 1) : 1) * 1.0) : baseW;

      ctx.beginPath();
      ctx.moveTo(x0, trackY);
      ctx.lineTo(x1, trackY);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = "butt";
      ctx.stroke();
    }

    // hand
    const handX = padX + this._displayFrac * trackLen;
    ctx.beginPath();
    ctx.moveTo(handX, trackY - baseW - LG_HAND_OVER);
    ctx.lineTo(handX, trackY + baseW + LG_HAND_OVER);
    ctx.strokeStyle = COLORS.accent2;
    ctx.lineWidth = LG_HAND_W;
    ctx.lineCap = "round";
    ctx.stroke();

    // caption
    if (this._label) {
      this._drawLabelBelow(ctx, w / 2, h - 4);
    }
  }

  _drawVertical(ctx, w, h) {
    const n = this._segments;
    const captionH = this._label ? 22 : 0;
    const trackX = w / 2;
    const padY = 8;
    const trackLen = h - padY * 2 - captionH;
    const segLen = trackLen / n;
    const gapPx = segLen * LG_GAP_FRAC;
    const baseW = LG_TRACK_W;

    // segments (bottom = max for vertical)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const color = lerpColor(COLORS.accent1, COLORS.accent2, t);
      const y0 = padY + (n - 1 - i) * segLen + gapPx / 2;
      const y1 = padY + (n - i) * segLen - gapPx / 2;
      const lw = this._growSegments ? baseW * (0.5 + (n > 1 ? i / (n - 1) : 1) * 1.0) : baseW;

      ctx.beginPath();
      ctx.moveTo(trackX, y0);
      ctx.lineTo(trackX, y1);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = "butt";
      ctx.stroke();
    }

    // hand
    const handY = padY + (1 - this._displayFrac) * trackLen;
    ctx.beginPath();
    ctx.moveTo(trackX - baseW - LG_HAND_OVER, handY);
    ctx.lineTo(trackX + baseW + LG_HAND_OVER, handY);
    ctx.strokeStyle = COLORS.accent2;
    ctx.lineWidth = LG_HAND_W;
    ctx.lineCap = "round";
    ctx.stroke();

    // caption
    if (this._label) {
      this._drawLabelBelow(ctx, w / 2, h - 4);
    }
  }

  _drawLabelBelow(ctx, centerX, baseY) {
    const ff = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
    const font = `13px ${ff}`;
    ctx.textBaseline = "bottom";
    ctx.font = font;
    const displayVal = String(Math.round(this._value));
    // For vertical gauges, trim label to first letter to fit narrow width
    const isVert = this._direction === "vertical";
    const displayLabel = isVert ? this._label.charAt(0) : this._label;
    const colonStr = " : ";
    const titleW = ctx.measureText(displayLabel).width;
    const colonW = ctx.measureText(colonStr).width;
    const valW   = ctx.measureText(displayVal).width;
    const totalW = titleW + colonW + valW;
    let x = centerX - totalW / 2;

    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.fg;
    ctx.fillText(displayLabel, x, baseY);
    x += titleW;
    ctx.fillText(colonStr, x, baseY);
    x += colonW;
    ctx.fillStyle = COLORS.accent2;
    ctx.fillText(displayVal, x, baseY);
  }

  setValue(v) {
    this._value = Math.max(this._min, Math.min(parseFloat(v), this._max));
    this.setAttribute("value", this._value);
  }
  getValue() { return this._value; }
}

/* ── Register ── */
customElements.define("circular-gauge", CircularGauge);
customElements.define("linear-gauge", LinearGauge);

/* ── Listen for palette changes ── */
document.addEventListener("palette-changed", () => {
  refreshColors();
  document.querySelectorAll("circular-gauge, linear-gauge").forEach(el => {
    if (el._draw) el._draw();
  });
});
