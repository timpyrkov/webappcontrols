import { COLORS, gradPair, captionAccent } from "../tokens.js";

/* ── Gradient direction (degrees, 0 = up, clockwise) ── */
const GRAD_ANGLE_DEG = 135; // ← tweak this to change gradient direction

/* ── Groove shading (concave lighting, adapted from gauges.js) ── */
const GROOVE = {
  lightAngle:    225,   // degrees — DISPLACEMENT DIRECTION: 0=right, 90=bottom, 180=left, 270=top
  depth:         0.8,   // 0..1 — how pronounced the concavity is
  shiftLight:    4,     // px offset of the light halo from edge
  shiftDark:     4,     // px offset of the dark halo from edge
  blur:          3,     // px blur applied to halos
  blurBloom:     0.7,   // 0..1 — bloom factor
  lightEnabled:  false, // Light halo disabled for cleaner recessed look
  darkEnabled:   true,  // Dark halo creates the groove effect
};

/* ── Niche shadow styling (matches gauges.js look) ── */
const NICHE_STYLE = {
  rimEnabled:   false,
  depthEnabled: false,
  rimBlur:      5,
  depthBlur:    3,
  rimSpread:    0,
  depthSpread:  0,
  rimPasses:    2,
  depthPasses:  2,
};
function nicheColors() {
  const isLight = document.documentElement.dataset.theme === "light";
  const rim   = isLight ? "white" : COLORS.neutral4;
  const depth = isLight ? COLORS.neutral12 : COLORS.neutral1;
  return [rim, depth];
}

/* ── Layout constants (fractions of component size) ── */
const OUTER_R   = 0.30;   // outer circle radius
const INNER_R   = 0.22;   // inner circle radius
const ARC_R     = 0.42;   // value-indicator arc radius (continuous mode)
const ARC_W     = 6;      // arc stroke width (px, before DPR scale)
const PTR_LEN   = 0.07;   // pointer length (fraction of size)
const PTR_OFF   = 0.05;   // pointer offset from inner edge (fraction)
const PTR_W     = 4;      // pointer stroke width (px)
const PTR_W_VOL = 2;      // pointer stroke width in volume/glow mode (px)
const GAP_DEG   = 20;     // gap at top for continuous arc (half-gap each side)
const LABEL_R   = 0.46;   // enum label radius
const CAPTION_H = 20;     // px reserved at bottom for caption text
const ANIM_MS   = 180;    // animation duration

/* ── Volume-mode layout (fractions of component size; R1=innermost, R5=outermost) ── */
const VOL_R5 = 0.300;   // outermost bezel disk (notably higher neutrals; no edge)
const VOL_R4 = 0.275;   // recess collar (slightly lower neutrals than R2; no edge)
const VOL_R3 = 0.255;   // knurled ring base radius (sine-modulated outer boundary)
const VOL_R2 = 0.205;   // convex transition ring (lighter edge)
const VOL_R1 = 0.155;   // inner concave cap (no edge)
const KNURL_TICKS = 12;        // number of knurl peaks around R3
const KNURL_AMPL  = 0.006;     // sine amplitude as fraction of S
const KNURL_SEGS  = 360;       // path smoothness for the wavy R3 boundary

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
    // Handle wrap-around for enum mode only; continuous mode is clamped
    if (this._mode === "enum") {
      let delta = angle - this._displayAngle;
      // Normalize delta to [-π, π] — take shortest path
      while (delta > Math.PI) delta -= TAU;
      while (delta < -Math.PI) delta += TAU;
      this._targetAngle = this._displayAngle + delta;
    } else {
      // Continuous mode: no wrap-around, direct path (clamped to min/max)
      this._targetAngle = angle;
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

  /* -- Volume style: 5-ring layout (R1…R5) + sine-modulated R3 edge + full-radius pointer -- */
  _drawVolume(ctx, cx, cy, S) {
    const angle = this._displayAngle;          // 0 = top, CW; drives R3 edge + pointer rotation
    const isLight = document.documentElement.dataset.theme === "light";

    /* R5 — outermost bezel disk (notably higher neutrals; convex 135°; no edge) */
    {
      const r = S * VOL_R5;
      const [a, b] = gradPair(COLORS.neutral7, COLORS.neutral5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG, a, b);
      ctx.fill();
    }

    /* R4 — recess collar disk (slightly lower neutrals than R2; convex 135°; no edge) */
    {
      const r = S * VOL_R4;
      const [a, b] = gradPair(COLORS.neutral4, COLORS.neutral2);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG, a, b);
      ctx.fill();
    }

    /* R3 — knurled ring with sine-modulated outer boundary that rotates with the pointer.
     *      Static linear gradient fill is clipped by the rotating wavy path; a dark stroke
     *      along the same path produces the knurl ridges.  N peaks rotate clockwise as
     *      `angle` increases (canvas y-axis points down, so we use sin(N*(t - angle))). */
    {
      const rBase = S * VOL_R3;
      const A = S * KNURL_AMPL;
      const N = KNURL_TICKS;
      const segs = KNURL_SEGS;
      const phaseShift = 3 * Math.PI / (2 * N);  // align pointer with sine peak

      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * TAU;
        const r = rBase + A * Math.sin(N * (t - angle + phaseShift));
        const x = cx + Math.cos(t) * r;
        const y = cy + Math.sin(t) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Static fill (slightly higher tones than R2)
      const [a, b] = gradPair(COLORS.neutral6, COLORS.neutral4);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, rBase + A, GRAD_ANGLE_DEG, a, b);
      ctx.fill();

      // Dark sine-modulated edge stroke (knurl ridges)
      ctx.strokeStyle = isLight ? COLORS.neutral7 : COLORS.neutral1;
      ctx.lineWidth = Math.max(1, S * 0.005);
      ctx.stroke();
    }

    /* R2 — convex transition ring (matches Gradient knob outer ring; lighter edge) */
    {
      const r = S * VOL_R2;
      const [a, b] = gradPair(COLORS.neutral4, COLORS.neutral2);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG, a, b);
      ctx.fill();
      ctx.strokeStyle = COLORS.edge2;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* R1 — innermost concave cap (matches Gradient knob inner ring; reversed direction; no edge) */
    {
      const r = S * VOL_R1;
      const [a, b] = gradPair(COLORS.neutral4, COLORS.neutral2);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      // 180° offset → concave (light at bottom-right instead of top-left)
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG + 180, a, b);
      ctx.fill();
    }

    /* Pointer — from center to (just inside) the nominal edge of R3; rotates with `angle`.
     *            Inner end (at center) is rounded; outer end (at R3 edge) is flat. */
    {
      const rEnd = S * VOL_R3 - S * 0.01;
      const sinA = Math.sin(angle), cosA = -Math.cos(angle);
      const xMid = cx + sinA * (rEnd * 0.5), yMid = cy + cosA * (rEnd * 0.5);
      const x2 = cx + sinA * rEnd, y2 = cy + cosA * rEnd;
      const g = ctx.createLinearGradient(cx, cy, x2, y2);
      g.addColorStop(0, COLORS.accent3);
      g.addColorStop(1, COLORS.accent1);

      // Inner half: rounded cap at center
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(xMid, yMid);
      ctx.strokeStyle = g;
      ctx.lineWidth = PTR_W_VOL;
      ctx.lineCap = "round";
      ctx.stroke();

      // Outer half: flat (butt) cap at R3 edge
      ctx.beginPath();
      ctx.moveTo(xMid, yMid);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = g;
      ctx.lineWidth = PTR_W_VOL;
      ctx.lineCap = "butt";
      ctx.stroke();
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
      ctx.fillStyle = COLORS.neutral4;
    } else {
      const [oTop, oBot] = gradPair(COLORS.neutral4, COLORS.neutral3);
      ctx.fillStyle = this._makeLinGrad(ctx, cx, cy, r, GRAD_ANGLE_DEG, oTop, oBot);
    }
    ctx.fill();
    if (!this.hasAttribute("flat") && (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled)) {
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
    const isVolume = this.hasAttribute("volume");

    if (isVolume) {
      // Volume mode: recessed niche track with rim/depth shadows and groove shading
      const trackPad = 4;
      const trackW = ARC_W + trackPad;
      const borderW = trackW + 2;
      const halfW = trackW / 2;
      const R1 = r - halfW;
      const R2 = r + halfW;
      const startRad = valAngle(gap);
      const endRad = valAngle(TAU - gap);
      const baseHex = COLORS.neutral4;
      const borderCol = COLORS.neutral4;
      const baseFill = COLORS.neutral3;
      const dpr = window.devicePixelRatio || 1;
      const [nicheRim, nicheDepth] = nicheColors();

      // Helper: stroke the full-range arc with round caps
      const drawArc = () => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, startRad, endRad);
        ctx.lineCap = "round";
        ctx.stroke();
      };

      // 1) Rim glow beneath
      if (NICHE_STYLE.rimEnabled) {
        ctx.save();
        ctx.shadowColor = nicheRim;
        ctx.shadowBlur = NICHE_STYLE.rimBlur;
        ctx.strokeStyle = nicheRim;
        ctx.lineWidth = borderW + NICHE_STYLE.rimSpread * 2;
        for (let p = 0; p < NICHE_STYLE.rimPasses; p++) drawArc();
        ctx.restore();
      }
      // 2) Depth glow beneath
      if (NICHE_STYLE.depthEnabled) {
        ctx.save();
        ctx.shadowColor = nicheDepth;
        ctx.shadowBlur = NICHE_STYLE.depthBlur;
        ctx.strokeStyle = nicheDepth;
        ctx.lineWidth = borderW + NICHE_STYLE.depthSpread * 2;
        for (let p = 0; p < NICHE_STYLE.depthPasses; p++) drawArc();
        ctx.restore();
      }
      // 3) Border + fill
      if (NICHE_STYLE.rimEnabled || NICHE_STYLE.depthEnabled) {
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = borderW;
        ctx.lineCap = "round";
        drawArc();
      }
      ctx.strokeStyle = baseFill;
      ctx.lineWidth = trackW;
      drawArc();

      // 4) Groove shading (concave lighting)
      this._drawGrooveShading(ctx, cx, cy, R1, R2, startRad, endRad, false, baseHex, this._w, this._h, dpr);

      // foreground accent arc
      const endAngle = this._displayAngle;
      if (endAngle <= gap + 0.001) return;

      // Gradient arc: accent1 at zero, accent5 at max
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
    } else {
      // Flat/Gradient mode: simple stroked arcs
      // background arc (neutral-5) — full range with gap at top
      ctx.beginPath();
      ctx.arc(cx, cy, r, valAngle(gap), valAngle(TAU - gap));
      ctx.strokeStyle = COLORS.neutral5;
      ctx.lineWidth   = ARC_W;
      ctx.lineCap     = "round";
      ctx.stroke();

      // foreground accent arc
      const endAngle = this._displayAngle;
      if (endAngle <= gap + 0.001) return;

      // Gradient arc: accent1 at zero, accent5 at max
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
  }

  /* -- groove shading helper (adapted from gauges.js) -- */
  _drawGrooveShading(ctx, cx, cy, R1, R2, startRad, endRad, ccw, baseHex, canvasW, canvasH, dpr) {
    const { depth, shiftLight, shiftDark, blur, blurBloom, lightEnabled, darkEnabled, lightAngle } = GROOVE;
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
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.globalCompositeOperation = "source-over";
    sctx.globalAlpha = 1;
    sctx.filter = "none";
    sctx.clearRect(0, 0, canvasW, canvasH);
    sctx.fillStyle = baseHex;
    sctx.fillRect(0, 0, canvasW, canvasH);

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

      hctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${haloAlpha})`;
      hctx.fillRect(0, 0, canvasW, canvasH);

      hctx.globalCompositeOperation = "destination-out";
      hctx.fillStyle = "rgba(0,0,0,1)";
      if (kind === "inner") {
        hctx.beginPath();
        hctx.rect(0, 0, canvasW, canvasH);
        hctx.arc(cx + ox, cy + oy, R1, 0, Math.PI * 2, true);
        hctx.fill("evenodd");
      } else {
        hctx.beginPath();
        hctx.arc(cx + ox, cy + oy, R2, 0, Math.PI * 2);
        hctx.fill();
      }

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

    // Mask scratch to the actual track shape (arc with rounded caps)
    sctx.globalCompositeOperation = "destination-in";
    sctx.globalAlpha = 1;
    const r = (R1 + R2) / 2;
    const trackW = R2 - R1;
    sctx.strokeStyle = "rgba(0,0,0,1)";
    sctx.lineWidth = trackW;
    sctx.lineCap = "round";
    sctx.beginPath();
    sctx.arc(cx, cy, r, startRad, endRad, ccw);
    sctx.stroke();

    // Composite scratch onto main canvas
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(_grooveScratch, 0, 0, sw, sh, 0, 0, canvasW, canvasH);
    ctx.restore();
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
    // For continuous mode, ignore pointer angles in the dead zone (gap at top)
    if (this._mode !== "enum") {
      const gap = GAP_DEG * DEG;
      // Normalize a to 0..TAU
      a = ((a % TAU) + TAU) % TAU;
      // Dead zone: angle < gap (right of top) or angle > TAU - gap (left of top)
      if (a < gap || a > TAU - gap) return;
    }
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

/* ── Listen for niche-shadows toggle ── */
document.addEventListener("niche-toggled", (e) => {
  const on = e.detail.enabled;
  NICHE_STYLE.rimEnabled = on;
  NICHE_STYLE.depthEnabled = on;
  document.querySelectorAll("rotary-knob").forEach(el => {
    if (el._draw) el._draw();
  });
});
