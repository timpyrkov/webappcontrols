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
  rimEnabled:   false,      // toggle rim glow on/off
  depthEnabled: false,      // toggle depth glow on/off
  rimColor:     null,       // null = auto from CSS niche tokens, or '#ffffff', 'red', etc. for debug
  depthColor:   null,       // null = auto from CSS niche tokens, or '#000000', 'cyan', etc. for debug
  rimBlur:      5,         // shadowBlur radius (spread of the gaussian blur)
  depthBlur:    3,          // shadowBlur radius
  rimSpread:    0,          // how much larger the hidden glow shape is than the border (px)
  depthSpread:  0,          // larger shape = more shadow visible beyond the border edge
  rimPasses:    2,          // number of draw passes (stacks opacity)
  depthPasses:  2,          // number of draw passes
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

/**
 * Compute number of "on" segments for discrete highlighting.
 * - If frac >= 0.01 (at least 1% of range), at least 1 segment is on.
 * - Segments turn on/off discretely at segment boundaries (rounded).
 * @param {number} frac - Current value fraction (0..1)
 * @param {number} n    - Total number of segments
 * @returns {number} Number of active segments (0..n)
 */
function activeSegments(frac, n) {
  if (frac < 0.01) return 0;
  return Math.max(1, Math.round(frac * n));
}
function hexAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Return [rimColor, depthColor] matching CSS --niche-rim / --niche-depth
 * from volume.css, respecting the current theme and NICHE_STYLE overrides.
 */
function nicheColors() {
  const isLight = document.documentElement.dataset.theme === "light";
  const rim = NICHE_STYLE.rimColor ||
    (isLight ? 'white' : COLORS.neutral4);
  const depth = NICHE_STYLE.depthColor ||
    (isLight ? COLORS.neutral12 : COLORS.neutral1);
  return [rim, depth];
}

/* ── Groove shading (concave lighting, adapted from groove/ prototype) ── */
const GROOVE = {
  lightAngle:    240,   // degrees — light source direction (0=right, 90=bottom, 180=left, 270=top, 45=top-right)
  depth:         0.8,   // 0..1 — how pronounced the concavity is
  shiftLight:    4,     // px offset of the light halo from edge
  shiftDark:     4,     // px offset of the dark halo from edge
  blur:          3,     // px blur applied to halos
  blurBloom:     0.7,   // 0..1 — bloom factor (lower = tighter glow)
  lightEnabled:  false, // Light halo disabled for cleaner recessed look
  darkEnabled:   true,  // Dark halo creates the groove effect
};

let _grooveScratch = null;
function _grooveEnsureScratch(w, h, dpr) {
  if (!_grooveScratch) _grooveScratch = document.createElement("canvas");
  const sw = Math.round(w * dpr);
  const sh = Math.round(h * dpr);
  if (_grooveScratch.width !== sw || _grooveScratch.height !== sh) {
    _grooveScratch.width = sw;
    _grooveScratch.height = sh;
  }
  return { sw, sh, sctx: _grooveScratch.getContext("2d") };
}

function _grooveAdjustL(hex, deltaL) {
  const [r, g, b] = hexToRgb(hex);
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
    else if (max === gf) h = (bf - rf) / d + 2;
    else h = (rf - gf) / d + 4;
    h /= 6;
  }
  l = Math.max(0, Math.min(1, l + deltaL / 100));
  let rr, gg, bb;
  if (s === 0) { rr = gg = bb = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (pp, qq, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return pp + (qq - pp) * 6 * t; if (t < 1/2) return qq; if (t < 2/3) return pp + (qq - pp) * (2/3 - t) * 6; return pp; };
    rr = hue2rgb(p, q, h + 1/3); gg = hue2rgb(p, q, h); bb = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(rr * 255), g: Math.round(gg * 255), b: Math.round(bb * 255) };
}

/**
 * Render the full grooved annulus on a scratch canvas (base color + 4 halo
 * passes mimicking top-left lighting), then composite it into the main canvas
 * masked to the gauge's track shape (arc with rounded caps).
 *
 * Faithful adaptation of the prototype in /groove/app.js.
 * 
 * @param {string} trackShape - "tapered" or "uniform"
 * @param {number} minHW, maxHW - half-widths for tapered track (ignored for uniform)
 */
function drawGrooveShading(ctx, cx, cy, R1, R2, startRad, endRad, ccw, baseHex, canvasW, canvasH, dpr, trackShape = "uniform", minHW = 0, maxHW = 0) {
  const { depth, shiftLight, shiftDark, blur, blurBloom, lightAngle, lightEnabled, darkEnabled } = GROOVE;
  if (depth <= 0) return;

  const lightRad = lightAngle * Math.PI / 180;
  const ux = Math.cos(lightRad);
  const uy = Math.sin(lightRad);
  const dL = 8 + depth * 26;
  const lightRgb = _grooveAdjustL(baseHex, dL);
  const darkRgb = _grooveAdjustL(baseHex, -dL);
  const haloAlpha = 0.28 + depth * 0.55;
  const strength = depth;

  const { sw, sh, sctx } = _grooveEnsureScratch(canvasW, canvasH, dpr);
  // Reset scratch to fresh state with the base groove color filling the canvas
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  sctx.globalAlpha = 1;
  sctx.filter = "none";
  sctx.clearRect(0, 0, canvasW, canvasH);
  sctx.fillStyle = baseHex;
  sctx.fillRect(0, 0, canvasW, canvasH);

  // Helper: render one halo (inner or outer, displaced by ox,oy, tinted rgb)
  // directly onto the main scratch with optional blur
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = sw;
  haloCanvas.height = sh;
  const hctx = haloCanvas.getContext("2d");

  const renderHalo = (kind, rgb, ox, oy) => {
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hctx.globalCompositeOperation = "source-over";
    hctx.globalAlpha = 1;
    hctx.filter = "none";
    hctx.clearRect(0, 0, canvasW, canvasH);

    // 1) Fill canvas with tint at haloAlpha
    hctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${haloAlpha})`;
    hctx.fillRect(0, 0, canvasW, canvasH);

    // 2) Cut out everything except the appropriate region (matching prototype)
    hctx.globalCompositeOperation = "destination-out";
    hctx.fillStyle = "rgba(0,0,0,1)";
    if (kind === "inner") {
      // Keep only inside the displaced inner disk
      hctx.beginPath();
      hctx.rect(0, 0, canvasW, canvasH);
      hctx.arc(cx + ox, cy + oy, R1, 0, Math.PI * 2, true);
      hctx.fill("evenodd");
    } else {
      // Keep only outside the displaced outer circle
      hctx.beginPath();
      hctx.arc(cx + ox, cy + oy, R2, 0, Math.PI * 2);
      hctx.fill();
    }

    // 3) Composite onto scratch with blur
    sctx.save();
    sctx.globalCompositeOperation = "source-over";
    const bloom = blur > 0 ? blurBloom : 1;
    sctx.globalAlpha = Math.min(1, strength * Math.max(0.15, bloom));
    sctx.filter = blur > 0 ? `blur(${Math.max(0.25, blur)}px)` : "none";
    sctx.drawImage(haloCanvas, 0, 0, sw, sh, 0, 0, canvasW, canvasH);
    sctx.filter = "none";
    sctx.restore();
  };

  const passes = [];
  if (lightEnabled) {
    passes.push(["outer", lightRgb, ux * shiftLight, uy * shiftLight]);
    passes.push(["inner", lightRgb, ux * shiftLight, uy * shiftLight]);
  }
  if (darkEnabled) {
    passes.push(["outer", darkRgb, -ux * shiftDark, -uy * shiftDark]);
    passes.push(["inner", darkRgb, -ux * shiftDark, -uy * shiftDark]);
  }
  for (const [kind, rgb, ox, oy] of passes) {
    renderHalo(kind, rgb, ox, oy);
  }

  // 4) Mask scratch to the actual track shape (arc with rounded caps)
  sctx.globalCompositeOperation = "destination-in";
  sctx.globalAlpha = 1;
  
  if (trackShape === "tapered") {
    // Tapered track: ONE path with polygon + both end caps as subpaths,
    // then a SINGLE fill. Separate fills with destination-in would intersect
    // (erasing everything); we need the UNION of the three shapes.
    const r = (R1 + R2) / 2;  // center radius
    const sweep = endRad - startRad;  // signed sweep (already correct for CW/CCW)
    const steps = 64;
    const startCx = cx + Math.cos(startRad) * r;
    const startCy = cy + Math.sin(startRad) * r;
    const endCx = cx + Math.cos(endRad) * r;
    const endCy = cy + Math.sin(endRad) * r;
    
    sctx.fillStyle = "rgba(0,0,0,1)";
    sctx.beginPath();
    // Subpath 1: tapered polygon
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const angle = startRad + f * sweep;
      const hw = minHW + f * (maxHW - minHW);
      const px = cx + Math.cos(angle) * (r + hw);
      const py = cy + Math.sin(angle) * (r + hw);
      if (s === 0) sctx.moveTo(px, py); else sctx.lineTo(px, py);
    }
    for (let s = steps; s >= 0; s--) {
      const f = s / steps;
      const angle = startRad + f * sweep;
      const hw = minHW + f * (maxHW - minHW);
      const px = cx + Math.cos(angle) * (r - hw);
      const py = cy + Math.sin(angle) * (r - hw);
      sctx.lineTo(px, py);
    }
    sctx.closePath();
    // Subpath 2: start cap circle (moveTo to avoid line from previous path)
    sctx.moveTo(startCx + minHW, startCy);
    sctx.arc(startCx, startCy, minHW, 0, Math.PI * 2);
    // Subpath 3: end cap circle
    sctx.moveTo(endCx + maxHW, endCy);
    sctx.arc(endCx, endCy, maxHW, 0, Math.PI * 2);
    // Single fill — masks to the UNION of all three subpaths
    sctx.fill();
  } else {
    // Uniform track: use arc stroke with round lineCap
    const r = (R1 + R2) / 2;
    const trackW = R2 - R1;
    sctx.strokeStyle = "rgba(0,0,0,1)";
    sctx.lineWidth = trackW;
    sctx.lineCap = "round";
    sctx.beginPath();
    sctx.arc(cx, cy, r, startRad, endRad, ccw);
    sctx.stroke();
  }

  // 5) Composite scratch onto main canvas (no blur — already baked in)
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(_grooveScratch, 0, 0, sw, sh, 0, 0, canvasW, canvasH);
  ctx.restore();
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
      const [nicheRim, nicheDepth] = nicheColors();
      const borderCol = COLORS.neutral4;
      // Use flat base color for groove shading (no radial gradient contamination)
      const baseFill = COLORS.neutral3;
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
          for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawTaper(1 + NICHE_STYLE.rimSpread);
          ctx.restore();
        }
        // 2) Depth glow beneath — shape larger than border by depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.fillStyle = nicheDepth;
          for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawTaper(1 + NICHE_STYLE.depthSpread);
          ctx.restore();
        }
        // 3) Track: border + fill (flat base for groove shading)
        if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
          ctx.fillStyle = borderCol;
          drawTaper(1);
        }
        ctx.fillStyle = baseFill;
        drawTaper(0);
        // 4) Groove shading (concave lighting)
        const dpr = window.devicePixelRatio || 1;
        drawGrooveShading(ctx, cx, cy, r - maxHW, r + maxHW, startRad, endRad, ccw, COLORS.neutral4, this._w, this._h, dpr, "tapered", minHW, maxHW);
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
          ctx.lineWidth = borderW + NICHE_STYLE.rimSpread * 2;
          for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawArc();
          ctx.restore();
        }
        // 2) Depth glow beneath — lineWidth wider than border by 2*depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.strokeStyle = nicheDepth;
          ctx.lineWidth = borderW + NICHE_STYLE.depthSpread * 2;
          for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawArc();
          ctx.restore();
        }
        // 3) Track: border + fill (flat base for groove shading)
        if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = borderW;
          drawArc();
        }
        ctx.strokeStyle = baseFill;
        ctx.lineWidth = trackW;
        drawArc();
        // 4) Groove shading (concave lighting)
        const dpr = window.devicePixelRatio || 1;
        const halfW = trackW / 2;
        drawGrooveShading(ctx, cx, cy, r - halfW, r + halfW, startRad, endRad, ccw, COLORS.neutral4, this._w, this._h, dpr, "uniform");
      }
    }

    // Compute how many segments are "on" based on animated display angle
    const displayFrac = (this._displayAngle - startRad) / sweep;
    const litCount = activeSegments(Math.max(0, Math.min(1, displayFrac)), n);
    const offColor = COLORS.neutral5;
    const useMultiply = this._volume && !!COLORS.gaugeSegOff;

    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const isOff = i >= litCount;
      const a0 = startRad + i * segSpan + (this._direction === "cw" ? gapRad / 2 : -gapRad / 2);
      const a1 = startRad + (i + 1) * segSpan - (this._direction === "cw" ? gapRad / 2 : -gapRad / 2);
      const lw = this._growSegments ? baseW * (0.5 + (n > 1 ? i / (n - 1) : 1) * 1.0) : baseW;

      if (isOff && useMultiply) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.beginPath();
        if (this._direction === "cw") ctx.arc(cx, cy, r, a0, a1);
        else ctx.arc(cx, cy, r, a0, a1, true);
        ctx.strokeStyle = COLORS.gaugeSegOff;
        ctx.lineWidth = lw;
        ctx.lineCap = "butt";
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        if (this._direction === "cw") ctx.arc(cx, cy, r, a0, a1);
        else ctx.arc(cx, cy, r, a0, a1, true);
        ctx.strokeStyle = isOff ? offColor : lerpColor(COLORS.accent1, COLORS.accent5, t);
        ctx.lineWidth = lw;
        ctx.lineCap = "butt";
        ctx.stroke();
      }
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
      const [nicheRim, nicheDepth] = nicheColors();
      // 1) Rim glow — circle larger than hub by rimSpread
      if (NICHE_STYLE.rimEnabled) {
        ctx.save();
        ctx.shadowColor = nicheRim;
        ctx.shadowBlur = NICHE_STYLE.rimBlur;
        ctx.fillStyle = nicheRim;
        for (let p = 0; p < NICHE_STYLE.rimPasses; p++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r + NICHE_STYLE.rimSpread, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      // 2) Depth glow — circle larger than hub by depthSpread
      if (NICHE_STYLE.depthEnabled) {
        ctx.save();
        ctx.shadowColor = nicheDepth;
        ctx.shadowBlur = NICHE_STYLE.depthBlur;
        ctx.fillStyle = nicheDepth;
        for (let p = 0; p < NICHE_STYLE.depthPasses; p++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r + NICHE_STYLE.depthSpread, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    if (this._flat) {
      ctx.fillStyle = COLORS.neutral5;
    } else {
      const [hTop, hBot] = gradPair(COLORS.neutral6, COLORS.neutral4);
      const grad = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
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
      const [nicheRim, nicheDepth] = nicheColors();
      const borderCol = COLORS.neutral4;
      const [fillA, fillB] = gradPair(COLORS.neutral4, COLORS.neutral5);
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
          for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawStadium(1 + NICHE_STYLE.rimSpread);
          ctx.restore();
        }
        // 2) Depth glow beneath — larger by depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.fillStyle = nicheDepth;
          for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawStadium(1 + NICHE_STYLE.depthSpread);
          ctx.restore();
        }
        // 3) Track: border + fill
        if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
          ctx.fillStyle = borderCol;
          drawStadium(1);
        }
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
          ctx.lineWidth = borderLW + NICHE_STYLE.rimSpread * 2;
          for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawLine();
          ctx.restore();
        }
        // 2) Depth glow beneath — wider by 2*depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.strokeStyle = nicheDepth;
          ctx.lineWidth = borderLW + NICHE_STYLE.depthSpread * 2;
          for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawLine();
          ctx.restore();
        }
        // 3) Track: border + fill
        if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = borderLW;
          drawLine();
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = trackW;
        drawLine();
      }
    }

    // segments — discrete highlighting
    const litCountH = activeSegments(this._displayFrac, n);
    const offColorH = COLORS.neutral5;
    const useMultiplyH = this._volume && !!COLORS.gaugeSegOff;

    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const isOff = i >= litCountH;
      const x0 = padX + i * segLen + gapPx / 2;
      const x1 = padX + (i + 1) * segLen - gapPx / 2;
      const lw = this._growSegments ? baseW * (0.5 + (n > 1 ? i / (n - 1) : 1) * 1.0) : baseW;

      if (isOff && useMultiplyH) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.beginPath();
        ctx.moveTo(x0, trackY);
        ctx.lineTo(x1, trackY);
        ctx.strokeStyle = COLORS.gaugeSegOff;
        ctx.lineWidth = lw;
        ctx.lineCap = "butt";
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.moveTo(x0, trackY);
        ctx.lineTo(x1, trackY);
        ctx.strokeStyle = isOff ? offColorH : lerpColor(COLORS.accent1, COLORS.accent5, t);
        ctx.lineWidth = lw;
        ctx.lineCap = "butt";
        ctx.stroke();
      }
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
      const [ptA, ptB] = gradPair(COLORS.neutral5, COLORS.neutral7);
      const ptGrad = ctx.createLinearGradient(handX + LG_PTR_W / 2, trackY, handX - LG_PTR_W / 2, trackY);
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
      const [nicheRim, nicheDepth] = nicheColors();
      const borderCol = COLORS.neutral4;
      const [fillA, fillB] = gradPair(COLORS.neutral4, COLORS.neutral5);
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
          for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawStadium(1 + NICHE_STYLE.rimSpread);
          ctx.restore();
        }
        // 2) Depth glow beneath — larger by depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.fillStyle = nicheDepth;
          for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawStadium(1 + NICHE_STYLE.depthSpread);
          ctx.restore();
        }
        // 3) Track: border + fill
        if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
          ctx.fillStyle = borderCol;
          drawStadium(1);
        }
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
          ctx.lineWidth = borderLW + NICHE_STYLE.rimSpread * 2;
          for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawLine();
          ctx.restore();
        }
        // 2) Depth glow beneath — wider by 2*depthSpread
        if (NICHE_STYLE.depthEnabled) {
          ctx.save();
          ctx.shadowColor = nicheDepth;
          ctx.shadowBlur = NICHE_STYLE.depthBlur;
          ctx.strokeStyle = nicheDepth;
          ctx.lineWidth = borderLW + NICHE_STYLE.depthSpread * 2;
          for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawLine();
          ctx.restore();
        }
        // 3) Track: border + fill
        if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = borderLW;
          drawLine();
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = trackW;
        drawLine();
      }
    }

    // segments (bottom = max for vertical) — discrete highlighting
    const litCountV = activeSegments(this._displayFrac, n);
    const offColorV = COLORS.neutral5;
    const useMultiplyV = this._volume && !!COLORS.gaugeSegOff;

    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const isOff = i >= litCountV;
      const y0 = padY + (n - 1 - i) * segLen + gapPx / 2;
      const y1 = padY + (n - i) * segLen - gapPx / 2;
      const lw = this._growSegments ? baseW * (0.5 + (n > 1 ? i / (n - 1) : 1) * 1.0) : baseW;

      if (isOff && useMultiplyV) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.beginPath();
        ctx.moveTo(trackX, y0);
        ctx.lineTo(trackX, y1);
        ctx.strokeStyle = COLORS.gaugeSegOff;
        ctx.lineWidth = lw;
        ctx.lineCap = "butt";
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.moveTo(trackX, y0);
        ctx.lineTo(trackX, y1);
        ctx.strokeStyle = isOff ? offColorV : lerpColor(COLORS.accent1, COLORS.accent5, t);
        ctx.lineWidth = lw;
        ctx.lineCap = "butt";
        ctx.stroke();
      }
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
      const [ptA, ptB] = gradPair(COLORS.neutral5, COLORS.neutral7);
      const ptGrad = ctx.createLinearGradient(trackX, handY + LG_PTR_W / 2, trackX, handY - LG_PTR_W / 2);
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

/* ── Listen for niche-shadows toggle ── */
document.addEventListener("niche-toggled", (e) => {
  const on = e.detail.enabled;
  NICHE_STYLE.rimEnabled = on;
  NICHE_STYLE.depthEnabled = on;
  document.querySelectorAll("circular-gauge, linear-gauge").forEach(el => {
    if (el._draw) el._draw();
  });
});
