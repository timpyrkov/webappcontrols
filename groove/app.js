(function () {
  "use strict";

  const canvas = document.getElementById("groove");
  const ctx = canvas.getContext("2d");

  const els = {
    r1: document.getElementById("r1"),
    r2: document.getElementById("r2"),
    angle: document.getElementById("angle"),
    depth: document.getElementById("depth"),
    shiftLight: document.getElementById("shift-light"),
    shiftDark: document.getElementById("shift-dark"),
    blur: document.getElementById("blur"),
    blurBloom: document.getElementById("blur-bloom"),
    r1Val: document.getElementById("r1-val"),
    r2Val: document.getElementById("r2-val"),
    angleVal: document.getElementById("angle-val"),
    depthVal: document.getElementById("depth-val"),
    shiftLightVal: document.getElementById("shift-light-val"),
    shiftDarkVal: document.getElementById("shift-dark-val"),
    blurVal: document.getElementById("blur-val"),
    blurBloomVal: document.getElementById("blur-bloom-val"),
    cGroove: document.getElementById("c-groove"),
    cBg: document.getElementById("c-bg"),
    metrics: document.getElementById("metrics"),
  };

  const R1_SLIDER_MIN = Number(els.r1.min);

  /** @type {HTMLCanvasElement | null} */
  let scratchRef = null;

  function parseHex(hex) {
    let h = String(hex).replace("#", "").trim();
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = parseInt(h, 16);
    if (!Number.isFinite(n) || h.length !== 6) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(rgb, a) {
    const al = Math.max(0, Math.min(1, a));
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${al})`;
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hueToRgb(p, q, t) {
    let u = t;
    if (u < 0) u += 1;
    if (u > 1) u -= 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  }

  function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r;
    let g;
    let b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h + 1 / 3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1 / 3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  function adjustLightness(hex, deltaL) {
    const rgb = parseHex(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const L = Math.max(0, Math.min(100, hsl.l + deltaL));
    return hslToRgb(hsl.h, hsl.s, L);
  }

  function resolveRadii(r1SliderMax, r2SliderMax) {
    let R1 = Math.round(Number(els.r1.value));
    let R2 = Math.round(Number(els.r2.value));

    R1 = Math.max(R1_SLIDER_MIN, Math.min(r1SliderMax, R1));
    R2 = Math.max(R1_SLIDER_MIN + 2, Math.min(r2SliderMax, R2));

    if (R2 <= R1 + 1) R2 = R1 + 1;

    els.r1.max = String(R2 - 1);
    els.r2.min = String(R1 + 1);

    R1 = Math.max(R1_SLIDER_MIN, Math.min(Number(els.r1.max), R1));
    R2 = Math.max(Number(els.r2.min), Math.min(r2SliderMax, R2));

    els.r1.value = String(R1);
    els.r2.value = String(R2);

    return { R1, R2 };
  }

  /** Paints tint everywhere, then cuts out everything beyond displaced R₁ — only the displaced inner disk remains. */
  function buildInnerHaloScratch(
    sctx,
    cssW,
    cssH,
    dpr,
    cx,
    cy,
    R1,
    ox,
    oy,
    rgb,
    innerAlpha
  ) {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, cssW, cssH);

    sctx.globalCompositeOperation = "source-over";
    sctx.globalAlpha = 1;
    sctx.fillStyle = rgba(rgb, innerAlpha);
    sctx.fillRect(-2, -2, cssW + 4, cssH + 4);

    sctx.globalCompositeOperation = "destination-out";
    sctx.fillStyle = "rgba(0,0,0,1)";
    sctx.globalAlpha = 1;

    const pad = 6;
    sctx.beginPath();
    sctx.rect(-pad, -pad, cssW + pad * 2, cssH + pad * 2);
    sctx.arc(cx + ox, cy + oy, R1, 0, Math.PI * 2, true);
    sctx.fill("evenodd");
  }

  /**
   * Paints tint everywhere, then cuts out inner disk + annulus — only exterior beyond displaced R₂ remains.
   */
  function buildOuterHaloScratch(
    sctx,
    cssW,
    cssH,
    dpr,
    cx,
    cy,
    R1,
    R2,
    ox,
    oy,
    rgb,
    innerAlpha
  ) {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, cssW, cssH);

    sctx.globalCompositeOperation = "source-over";
    sctx.globalAlpha = 1;
    sctx.fillStyle = rgba(rgb, innerAlpha);
    sctx.fillRect(-2, -2, cssW + 4, cssH + 4);

    sctx.globalCompositeOperation = "destination-out";
    sctx.fillStyle = "rgba(0,0,0,1)";
    sctx.globalAlpha = 1;

    sctx.beginPath();
    sctx.arc(cx + ox, cy + oy, R1, 0, Math.PI * 2);
    sctx.fill();

    sctx.beginPath();
    sctx.arc(cx + ox, cy + oy, R2, 0, Math.PI * 2);
    sctx.arc(cx + ox, cy + oy, R1, 0, Math.PI * 2, true);
    sctx.fill("evenodd");
  }

  function ensureScratch(cssW, cssH, dpr) {
    if (!scratchRef) scratchRef = document.createElement("canvas");
    const sw = Math.max(1, Math.round(cssW * dpr));
    const sh = Math.max(1, Math.round(cssH * dpr));
    if (scratchRef.width !== sw || scratchRef.height !== sh) {
      scratchRef.width = sw;
      scratchRef.height = sh;
    }
    return { sw, sh, sctx: scratchRef.getContext("2d") };
  }

  function compositeScratchOntoMain(
    sw,
    sh,
    cssW,
    cssH,
    dpr,
    strength,
    blurCssPx,
    blurBloomFrac
  ) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    const b = blurCssPx > 0 ? blurBloomFrac : 1;
    ctx.globalAlpha = Math.min(1, strength * Math.max(0.15, b));
    ctx.imageSmoothingEnabled = true;
    ctx.filter =
      blurCssPx > 0 ? `blur(${Math.max(0.25, blurCssPx)}px)` : "none";
    ctx.drawImage(scratchRef, 0, 0, sw, sh, 0, 0, cssW, cssH);
    ctx.filter = "none";
    ctx.restore();
  }

  /**
   * @param {'outer' | 'inner'} kind
   */
  function drawHaloOntoMain(
    kind,
    rgb,
    innerAlpha,
    ox,
    oy,
    strength,
    cssW,
    cssH,
    dpr,
    cx,
    cy,
    R1,
    R2,
    blurCssPx,
    blurBloomFrac
  ) {
    if (strength <= 0) return;
    const { sw, sh, sctx } = ensureScratch(cssW, cssH, dpr);
    if (kind === "outer") {
      buildOuterHaloScratch(
        sctx,
        cssW,
        cssH,
        dpr,
        cx,
        cy,
        R1,
        R2,
        ox,
        oy,
        rgb,
        innerAlpha
      );
    } else {
      buildInnerHaloScratch(
        sctx,
        cssW,
        cssH,
        dpr,
        cx,
        cy,
        R1,
        ox,
        oy,
        rgb,
        innerAlpha
      );
    }
    compositeScratchOntoMain(
      sw,
      sh,
      cssW,
      cssH,
      dpr,
      strength,
      blurCssPx,
      blurBloomFrac
    );
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 520;
    const cssH = cssW;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = cssW / 2;
    const cy = cssH / 2;
    const half = Math.min(cssW, cssH) / 2 - 12;
    const r2SliderMax = Math.floor(half * 0.92);
    const r1SliderMax = Math.max(R1_SLIDER_MIN + 2, r2SliderMax - 2);

    const { R1, R2 } = resolveRadii(r1SliderMax, r2SliderMax);
    const lightDeg = Number(els.angle.value);
    const depthT = Number(els.depth.value) / 100;
    const shiftLightPx = Math.max(0, Number(els.shiftLight.value));
    const shiftDarkPx = Math.max(0, Number(els.shiftDark.value));
    const blurCssPx = Math.max(0, Number(els.blur.value));
    const blurBloomFrac = Number(els.blurBloom.value) / 100;
    const dR = R2 - R1;

    const grooveHex = els.cGroove.value;
    const cBg = els.cBg.value;
    const lightRad = (lightDeg * Math.PI) / 180;
    const ux = Math.cos(lightRad);
    const uy = Math.sin(lightRad);

    const dL = 8 + depthT * 26;
    const lightRgb = adjustLightness(grooveHex, dL);
    const darkRgb = adjustLightness(grooveHex, -dL);
    const haloAlpha = 0.28 + depthT * 0.55;
    const layerStrength = depthT;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = grooveHex;
    ctx.fillRect(0, 0, cssW, cssH);

    const haloPasses = [
      ["outer", lightRgb, ux * shiftLightPx, uy * shiftLightPx],
      ["outer", darkRgb, -ux * shiftDarkPx, -uy * shiftDarkPx],
      ["inner", lightRgb, ux * shiftLightPx, uy * shiftLightPx],
      ["inner", darkRgb, -ux * shiftDarkPx, -uy * shiftDarkPx],
    ];
    for (const [kind, rgb, ox, oy] of haloPasses) {
      drawHaloOntoMain(
        kind,
        rgb,
        haloAlpha,
        ox,
        oy,
        layerStrength,
        cssW,
        cssH,
        dpr,
        cx,
        cy,
        R1,
        R2,
        blurCssPx,
        blurBloomFrac
      );
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = cBg;
    ctx.beginPath();
    ctx.arc(cx, cy, R1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.rect(0, 0, cssW, cssH);
    ctx.arc(cx, cy, R2, 0, Math.PI * 2, true);
    ctx.fill("evenodd");

    ctx.strokeStyle = grooveHex;
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1, dpr > 1 ? 1.5 : 2);
    ctx.beginPath();
    ctx.arc(cx, cy, R1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R2, 0, Math.PI * 2);
    ctx.stroke();

    els.r1Val.textContent = String(R1);
    els.r2Val.textContent = String(R2);
    els.angleVal.textContent = `${Math.round(lightDeg)}°`;
    els.depthVal.textContent = `${Math.round(depthT * 100)}%`;
    els.shiftLightVal.textContent = `${Math.round(shiftLightPx)}px`;
    els.shiftDarkVal.textContent = `${Math.round(shiftDarkPx)}px`;
    els.blurVal.textContent = blurCssPx <= 0 ? "off" : `${Math.round(blurCssPx)}px`;
    els.blurBloomVal.textContent = `${Math.round(blurBloomFrac * 100)}%`;

    els.metrics.innerHTML = [
      `ΔR = <code>${dR.toFixed(1)}</code>`,
      `ΔL ≈ <code>${dL.toFixed(1)}</code>`,
      `shift L/D = <code>${shiftLightPx.toFixed(0)}</code> / <code>${shiftDarkPx.toFixed(0)}</code>`,
      blurCssPx <= 0
        ? `blur = <code>off</code>`
        : `blur = <code>${blurCssPx.toFixed(0)}px</code> · bloom <code>${(blurBloomFrac * 100).toFixed(0)}%</code>`,
    ].join(" · ");
  }

  [
    els.r1,
    els.r2,
    els.angle,
    els.depth,
    els.shiftLight,
    els.shiftDark,
    els.blur,
    els.blurBloom,
    els.cGroove,
    els.cBg,
  ].forEach((el) => el.addEventListener("input", draw));

  window.addEventListener("resize", draw);
  draw();
})();
