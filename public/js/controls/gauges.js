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

import { COLORS, refreshColors, gradPair, captionAccent } from "../tokens.js";

/* ── Niche shadow styling ── */
const NICHE_STYLE = {
  rimEnabled:   true,       // toggle rim glow on/off
  depthEnabled: true,       // toggle depth glow on/off
  rimColor:     '#ffffff',  // override: null = palette neutral12 (light), or '#ffffff', 'red', etc. for debug
  depthColor:   '#000000',  // override: null = palette neutral1 (dark), or '#000000', 'cyan', etc. for debug
  rimBlur:      6,          // shadowBlur radius
  depthBlur:    3,          // shadowBlur radius
};

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
function hexAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
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
const CG_HAND_R   = 0.30;
const CG_HUB_R    = 0.06;
const CG_HAND_W   = 3;
const CG_GAP_FRAC = 0.25;   // gap between segments as fraction of segment angular span

class CircularGauge extends HTMLElement {

  static get observedAttributes() {
    return ["value", "min", "max", "start-angle", "end-angle",
            "direction", "segments", "grow-segments", "label", "flat", "volume"];
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
    this._draw();
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
    this._flat       = this.hasAttribute("flat");
    this._volume     = this.hasAttribute("volume");
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

    // Volume: track niche — two same-shape objects beneath, then the track on top
    if (this._volume) {
      const ccw = this._direction !== "cw";
      const endRad = startRad + sweep;
      const nicheRim = NICHE_STYLE.rimColor || COLORS.neutral12;
      const nicheDepth = NICHE_STYLE.depthColor || COLORS.neutral1;
      const borderCol = COLORS.neutral4;
      const [fillA, fillB] = gradPair(COLORS.neutral2, COLORS.neutral4);
      const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      grad.addColorStop(0, fillA);
      grad.addColorStop(1, fillB);
      const trackPad = 4;
      const trackW = baseW + trackPad;
      const borderW = trackW + 2;

      if (this._growSegments) {
        const minHW = (baseW * 0.5 + trackPad) / 2;
        const maxHW = (baseW * 1.5 + trackPad) / 2;
        const steps = 64;
        const startCx = cx + Math.cos(startRad) * r;
        const startCy = cy + Math.sin(startRad) * r;
        const endCx = cx + Math.cos(endRad) * r;
        const endCy = cy + Math.sin(endRad) * r;
        // Helper: draw tapered band + end caps at given margin
        const drawTaper = (m) => {
          ctx.beginPath();
          for (let s = 0; s <= steps; s++) {
            const f = s / steps;
            const angle = startRad + f * sweep;
            const hw = minHW + f * (maxHW - minHW) + m;
            const px = cx + Math.cos(angle) * (r + hw);
            const py = cy + Math.sin(angle) * (r + hw);
            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          for (let s = steps; s >= 0; s--) {
            const f = s / steps;
            const angle = startRad + f * sweep;
            const hw = minHW + f * (maxHW - minHW) + m;
            const px = cx + Math.cos(angle) * (r - hw);
            const py = cy + Math.sin(angle) * (r - hw);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.arc(startCx, startCy, minHW + m, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(endCx, endCy, maxHW + m, 0, TAU);
          ctx.fill();
        };
        // 1) Rim glow beneath — shape larger than border by rimSpread
        if (NICHE_STYLE.rimEnabled) {
          ctx.save();
          ctx.shadowColor = nicheRim;
          ctx.shadowBlur = NICHE_STYLE.rimBlur;
          ctx.fillStyle = nicheRim;
          drawTaper(1);
          ctx.restore();
        }
        // 2) Depth glow beneath — shape larger than border by depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.fillStyle = nicheDepth;
          drawTaper(1);
          ctx.restore();
        }
        // 3) Track: border + fill
        ctx.fillStyle = borderCol;
        drawTaper(1);
        ctx.fillStyle = grad;
        drawTaper(0);
      } else {
        // Uniform track
        const drawArc = () => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, startRad, endRad, ccw);
          ctx.lineCap = "round";
          ctx.stroke();
        };
        // 1) Rim glow beneath — lineWidth wider than border by 2*rimSpread
        if (NICHE_STYLE.rimEnabled) {
          ctx.save();
          ctx.shadowColor = nicheRim;
          ctx.shadowBlur = NICHE_STYLE.rimBlur;
          ctx.strokeStyle = nicheRim;
          ctx.lineWidth = borderW;
          drawArc();
          ctx.restore();
        }
        // 2) Depth glow beneath — lineWidth wider than border by 2*depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.strokeStyle = nicheDepth;
          ctx.lineWidth = borderW;
          drawArc();
          ctx.restore();
        }
        // 3) Track: border + fill
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = borderW;
        drawArc();
        ctx.strokeStyle = grad;
        ctx.lineWidth = trackW;
        drawArc();
      }
    }

    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const color = lerpColor(COLORS.accent1, COLORS.accent5, t);
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

    // Volume: needle shadow
    if (this._volume) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    if (this._flat) {
      ctx.strokeStyle = COLORS.accent1;
    } else {
      const grad = ctx.createLinearGradient(cx, cy, x, y);
      grad.addColorStop(0, COLORS.accent5);
      grad.addColorStop(1, COLORS.accent1);
      ctx.strokeStyle = grad;
    }
    ctx.lineWidth = CG_HAND_W;
    ctx.lineCap = "round";
    ctx.stroke();

    if (this._volume) ctx.restore();
  }

  _drawHub(ctx, cx, cy, S) {
    const r = S * CG_HUB_R;

    // Volume: hub niche — two glow objects beneath, hub covers them
    if (this._volume) {
      const nicheRim = NICHE_STYLE.rimColor || COLORS.neutral12;
      const nicheDepth = NICHE_STYLE.depthColor || COLORS.neutral1;
      // 1) Rim glow — circle larger than hub by rimSpread
      if (NICHE_STYLE.rimEnabled) {
        ctx.save();
        ctx.shadowColor = nicheRim;
        ctx.shadowBlur = NICHE_STYLE.rimBlur;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fillStyle = nicheRim;
        ctx.fill();
        ctx.restore();
      }
      // 2) Depth glow — circle larger than hub by depthSpread
      if (NICHE_STYLE.depthEnabled) {
        ctx.save();
        ctx.shadowColor = nicheDepth;
        ctx.shadowBlur = NICHE_STYLE.depthBlur;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fillStyle = nicheDepth;
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    if (this._flat) {
      ctx.fillStyle = COLORS.neutral5;
    } else {
      const [hTop, hBot] = gradPair(COLORS.neutral9, COLORS.neutral5);
      const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      grad.addColorStop(0, hTop);
      grad.addColorStop(1, hBot);
      ctx.fillStyle = grad;
    }
    ctx.fill();
    if (!this._flat) {
      ctx.strokeStyle = COLORS.edge2;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawCaption(ctx, w, h, cy, S) {
    const baseY = cy + S * CG_ARC_R + 20;
    const ff = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
    const font = `13px ${ff}`;
    ctx.textBaseline = "top";
    ctx.font = font;
    const centerX = w / 2;
    const displayVal = String(Math.round(this._value));

    // Reference value = widest possible string for stable layout
    const sMin = String(Math.round(this._min));
    const sMax = String(Math.round(this._max));
    const refVal = sMin.length >= sMax.length ? sMin : sMax;

    if (!this._label) {
      const refW = ctx.measureText(refVal).width;
      const valX = centerX - refW / 2;
      ctx.fillStyle = captionAccent();
      ctx.textAlign = "left";
      ctx.fillText(displayVal, valX, baseY);
      return;
    }

    const colonStr = " : ";
    const titleW  = ctx.measureText(this._label).width;
    const colonW  = ctx.measureText(colonStr).width;
    const refW    = ctx.measureText(refVal).width;
    const totalW  = titleW + colonW + refW;
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
const LG_PTR_W     = 5;  // pointer stroke width
const LG_PTR_OVER  = 3;  // pointer overshoot past track edges (px)
const LG_PTR_FILL  = () => COLORS.neutral7;  // pointer fill color
const LG_PTR_EDGE  = () => COLORS.edge2;     // pointer edge color

class LinearGauge extends HTMLElement {

  static get observedAttributes() {
    return ["value", "min", "max", "size", "direction",
            "segments", "grow-segments", "label", "flat", "volume"];
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
    this._volume = this.hasAttribute("volume");
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
    const captionH = this._label ? 28 : 0;
    const trackY = (h - captionH) / 2;
    const padX = 10 + (this._volume ? 4 : 0);
    const trackLen = w - padX * 2;
    const segLen = trackLen / n;
    const gapPx = segLen * LG_GAP_FRAC;
    const baseW = LG_TRACK_W;
    const trackPad = 4;

    // Volume: track niche — two same-shape glow objects beneath, then track on top
    if (this._volume) {
      const nicheRim = NICHE_STYLE.rimColor || COLORS.neutral12;
      const nicheDepth = NICHE_STYLE.depthColor || COLORS.neutral1;
      const borderCol = COLORS.neutral4;
      const [fillA, fillB] = gradPair(COLORS.neutral2, COLORS.neutral4);
      const grad = ctx.createLinearGradient(padX, trackY - baseW / 2, padX, trackY + baseW / 2);
      grad.addColorStop(0, fillA);
      grad.addColorStop(1, fillB);
      const trackW = baseW + trackPad;
      const borderLW = trackW + 2;

      if (this._growSegments) {
        const minR = (baseW * 0.5 + trackPad) / 2;
        const maxR = (baseW * 1.5 + trackPad) / 2;
        const drawStadium = (m) => {
          const r1 = minR + m, r2 = maxR + m;
          ctx.beginPath();
          ctx.arc(padX, trackY, r1, Math.PI * 0.5, -Math.PI * 0.5, false);
          ctx.lineTo(padX + trackLen, trackY - r2);
          ctx.arc(padX + trackLen, trackY, r2, -Math.PI * 0.5, Math.PI * 0.5, false);
          ctx.lineTo(padX, trackY + r1);
          ctx.closePath();
          ctx.fill();
        };
        // 1) Rim glow beneath — larger by rimSpread
        if (NICHE_STYLE.rimEnabled) {
          ctx.save();
          ctx.shadowColor = nicheRim;
          ctx.shadowBlur = NICHE_STYLE.rimBlur;
          ctx.fillStyle = nicheRim;
          drawStadium(1);
          ctx.restore();
        }
        // 2) Depth glow beneath — larger by depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.fillStyle = nicheDepth;
          drawStadium(1);
          ctx.restore();
        }
        // 3) Track: border + fill
        ctx.fillStyle = borderCol;
        drawStadium(1);
        ctx.fillStyle = grad;
        drawStadium(0);
      } else {
        // Uniform track
        const drawLine = () => {
          ctx.beginPath();
          ctx.moveTo(padX, trackY);
          ctx.lineTo(padX + trackLen, trackY);
          ctx.lineCap = "round";
          ctx.stroke();
        };
        // 1) Rim glow beneath — wider by 2*rimSpread
        if (NICHE_STYLE.rimEnabled) {
          ctx.save();
          ctx.shadowColor = nicheRim;
          ctx.shadowBlur = NICHE_STYLE.rimBlur;
          ctx.strokeStyle = nicheRim;
          ctx.lineWidth = borderLW;
          drawLine();
          ctx.restore();
        }
        // 2) Depth glow beneath — wider by 2*depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.strokeStyle = nicheDepth;
          ctx.lineWidth = borderLW;
          drawLine();
          ctx.restore();
        }
        // 3) Track: border + fill
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = borderLW;
        drawLine();
        ctx.strokeStyle = grad;
        ctx.lineWidth = trackW;
        drawLine();
      }
    }

    // segments
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const color = lerpColor(COLORS.accent1, COLORS.accent5, t);
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

    // Volume: pointer shadow
    if (this._volume) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;
    }

    // pointer (rounded stroke)
    const handX = padX + this._displayFrac * trackLen;
    const trackHW = baseW / 2 + (this._volume ? trackPad / 2 : 0);
    const hY0 = trackY - trackHW - LG_PTR_OVER;
    const hY1 = trackY + trackHW + LG_PTR_OVER;
    ctx.beginPath();
    ctx.moveTo(handX, hY0);
    ctx.lineTo(handX, hY1);
    ctx.strokeStyle = LG_PTR_EDGE();
    ctx.lineWidth = LG_PTR_W + 2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(handX, hY0);
    ctx.lineTo(handX, hY1);
    if (this._volume) {
      const [ptA, ptB] = gradPair(COLORS.neutral6, COLORS.neutral9);
      const ptGrad = ctx.createLinearGradient(handX - LG_PTR_W / 2, trackY, handX + LG_PTR_W / 2, trackY);
      ptGrad.addColorStop(0, ptA);
      ptGrad.addColorStop(1, ptB);
      ctx.strokeStyle = ptGrad;
    } else {
      ctx.strokeStyle = LG_PTR_FILL();
    }
    ctx.lineWidth = LG_PTR_W;
    ctx.lineCap = "round";
    ctx.stroke();

    if (this._volume) ctx.restore();

    // caption
    if (this._label) {
      this._drawLabelBelow(ctx, w / 2, h - 4);
    }
  }

  _drawVertical(ctx, w, h) {
    const n = this._segments;
    const captionH = this._label ? 22 : 0;
    const trackX = w / 2;
    const padY = 8 + (this._volume ? 6 : 0);
    const trackLen = h - padY * 2 - captionH;
    const segLen = trackLen / n;
    const gapPx = segLen * LG_GAP_FRAC;
    const baseW = LG_TRACK_W;
    const trackPad = 4;

    // Volume: track niche — two same-shape glow objects beneath, then track on top
    if (this._volume) {
      const nicheRim = NICHE_STYLE.rimColor || COLORS.neutral12;
      const nicheDepth = NICHE_STYLE.depthColor || COLORS.neutral1;
      const borderCol = COLORS.neutral4;
      const [fillA, fillB] = gradPair(COLORS.neutral2, COLORS.neutral4);
      const grad = ctx.createLinearGradient(trackX - baseW / 2, padY, trackX + baseW / 2, padY);
      grad.addColorStop(0, fillA);
      grad.addColorStop(1, fillB);
      const trackW = baseW + trackPad;
      const borderLW = trackW + 2;

      if (this._growSegments) {
        const maxR = (baseW * 1.5 + trackPad) / 2;
        const minR = (baseW * 0.5 + trackPad) / 2;
        const drawStadium = (m) => {
          const r1 = maxR + m, r2 = minR + m;
          ctx.beginPath();
          ctx.arc(trackX, padY, r1, Math.PI, 0, false);
          ctx.lineTo(trackX + r2, padY + trackLen);
          ctx.arc(trackX, padY + trackLen, r2, 0, Math.PI, false);
          ctx.lineTo(trackX - r1, padY);
          ctx.closePath();
          ctx.fill();
        };
        // 1) Rim glow beneath — larger by rimSpread
        if (NICHE_STYLE.rimEnabled) {
          ctx.save();
          ctx.shadowColor = nicheRim;
          ctx.shadowBlur = NICHE_STYLE.rimBlur;
          ctx.fillStyle = nicheRim;
          drawStadium(1);
          ctx.restore();
        }
        // 2) Depth glow beneath — larger by depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.fillStyle = nicheDepth;
          drawStadium(1);
          ctx.restore();
        }
        // 3) Track: border + fill
        ctx.fillStyle = borderCol;
        drawStadium(1);
        ctx.fillStyle = grad;
        drawStadium(0);
      } else {
        // Uniform track
        const drawLine = () => {
          ctx.beginPath();
          ctx.moveTo(trackX, padY);
          ctx.lineTo(trackX, padY + trackLen);
          ctx.lineCap = "round";
          ctx.stroke();
        };
        // 1) Rim glow beneath — wider by 2*rimSpread
        if (NICHE_STYLE.rimEnabled) {
          ctx.save();
          ctx.shadowColor = nicheRim;
          ctx.shadowBlur = NICHE_STYLE.rimBlur;
          ctx.strokeStyle = nicheRim;
          ctx.lineWidth = borderLW;
          drawLine();
          ctx.restore();
        }
        // 2) Depth glow beneath — wider by 2*depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.strokeStyle = nicheDepth;
          ctx.lineWidth = borderLW;
          drawLine();
          ctx.restore();
        }
        // 3) Track: border + fill
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = borderLW;
        drawLine();
        ctx.strokeStyle = grad;
        ctx.lineWidth = trackW;
        drawLine();
      }
    }

    // segments (bottom = max for vertical)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const color = lerpColor(COLORS.accent1, COLORS.accent5, t);
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

    // Volume: pointer shadow
    if (this._volume) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;
    }

    // pointer (rounded stroke)
    const handY = padY + (1 - this._displayFrac) * trackLen;
    const trackHW = baseW / 2 + (this._volume ? trackPad / 2 : 0);
    const hX0 = trackX - trackHW - LG_PTR_OVER;
    const hX1 = trackX + trackHW + LG_PTR_OVER;
    ctx.beginPath();
    ctx.moveTo(hX0, handY);
    ctx.lineTo(hX1, handY);
    ctx.strokeStyle = LG_PTR_EDGE();
    ctx.lineWidth = LG_PTR_W + 2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hX0, handY);
    ctx.lineTo(hX1, handY);
    if (this._volume) {
      const [ptA, ptB] = gradPair(COLORS.neutral6, COLORS.neutral9);
      const ptGrad = ctx.createLinearGradient(trackX, handY - LG_PTR_W / 2, trackX, handY + LG_PTR_W / 2);
      ptGrad.addColorStop(0, ptA);
      ptGrad.addColorStop(1, ptB);
      ctx.strokeStyle = ptGrad;
    } else {
      ctx.strokeStyle = LG_PTR_FILL();
    }
    ctx.lineWidth = LG_PTR_W;
    ctx.lineCap = "round";
    ctx.stroke();

    if (this._volume) ctx.restore();

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

    // Reference value = widest possible string for stable layout
    const sMin = String(Math.round(this._min));
    const sMax = String(Math.round(this._max));
    const refVal = sMin.length >= sMax.length ? sMin : sMax;

    // For vertical gauges, trim label to first letter to fit narrow width
    const isVert = this._direction === "vertical";
    const displayLabel = isVert ? this._label.charAt(0) : this._label;
    const colonStr = " : ";
    const titleW = ctx.measureText(displayLabel).width;
    const colonW = ctx.measureText(colonStr).width;
    const refW   = ctx.measureText(refVal).width;
    const totalW = titleW + colonW + refW;
    let x = centerX - totalW / 2;

    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.fg;
    ctx.fillText(displayLabel, x, baseY);
    x += titleW;
    ctx.fillText(colonStr, x, baseY);
    x += colonW;
    ctx.fillStyle = captionAccent();
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
