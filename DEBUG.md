# Gauge Niche Shadow — Debug Checklist

Setting `rimColor`/`depthColor` to `null` in `NICHE_STYLE` makes shadows invisible.
Hardcoded `'#ffffff'`/`'#000000'` works. Below are ranked possible causes.

## Priority Fixes

- [x] **1. Wrong neutral tokens — must match CSS niche tokens exactly** *(APPLIED)*
  - CSS dark: `--niche-rim: color-mix(neutral-4, 80%)`, `--niche-depth: color-mix(neutral-1, 90%)`
  - CSS light: `--niche-rim: color-mix(#ffffff, 100%)`, `--niche-depth: color-mix(neutral-10, 90%)`
  - JS uses `COLORS.neutral12` / `COLORS.neutral1` — wrong tokens, wrong per-theme logic
  - Fix: mirror CSS exactly with `isLight` branching and correct token picks

- [x] **2. Missing alpha — CSS uses color-mix with transparency, JS uses solid hex** *(APPLIED)*
  - `COLORS.neutral12` = solid `#f1f2f4`, no alpha
  - CSS `--niche-rim` = `color-mix(in srgb, var(--neutral-4) 80%, transparent)` has 20% transparency
  - Fix: wrap with `hexAlpha()` to match CSS alpha values

- [x] **3. Rim/depth semantics flip between themes** *(APPLIED)*
  - Dark: rim = mid-dark (`neutral4`), depth = black (`neutral1`)
  - Light: rim = white (`#ffffff`), depth = light gray (`neutral10`)
  - Current JS: rim = `neutral12`, depth = `neutral1` — wrong for BOTH themes
  - Fix: use different tokens per theme, matching CSS

- [ ] **4. Shadow color too close to track background — invisible contrast**
  - Track fill: `gradPair(neutral2, neutral4)` — in light theme these are dark grays
  - If shadow is also dark gray (e.g. `neutral1` in dark theme) → barely visible
  - Fix: ensure shadow colors have enough contrast against track fill

- [ ] **5. Stale COLORS cache — initial load reads dark-theme defaults**
  - `COLORS` reads CSS vars at import time (module top-level)
  - If CSS not yet applied → fallback to hardcoded dark-theme hex
  - `refreshColors()` is called on `palette-changed` but NOT on initial draw
  - Fix: call `refreshColors()` inside draw or connectedCallback

- [ ] **6. DPR scaling dilutes shadowBlur**
  - Canvas has `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
  - shadowBlur=6 in CSS px may appear as 3px visually on 2x displays
  - Fix: multiply shadowBlur by dpr if needed (test first)

- [ ] **7. Glow shape same size as border — shadow fully covered**
  - Glow drawn at margin=1, border also at margin=1 → border covers glow
  - Only blur extending OUTSIDE border is visible (very faint at low blur)
  - Fix: may need glow at margin=1.5 or 2 to create visible gap

- [ ] **8. shadowBlur too low for visual effect**
  - `rimBlur: 6`, `depthBlur: 3` — canvas blur fades exponentially
  - With solid cover on top, only outer halo visible → very subtle
  - Fix: increase blur values or combine with margin offset

- [ ] **9. Event listener timing — palette-changed missed on first load**
  - Listener attached at bottom of file after `customElements.define()`
  - If app.js dispatches before gauges.js finishes loading → missed
  - Fix: also refresh inside `connectedCallback` or first `_draw()`

- [ ] **10. refreshColors() not called before first draw**
  - `_resize()` → `_draw()` happens in `connectedCallback`
  - But `refreshColors()` only runs on `palette-changed` event
  - First draw may use stale/default colors
  - Fix: call `refreshColors()` at top of `_draw()` or in `connectedCallback`

## Lower Priority

- [ ] **11. ctx.save/restore boundary issues** — shadow state leaking between layers
- [ ] **12. hexToRgb requires 6-digit hex** — short hex like `#fff` would fail
- [ ] **13. Multiple palette-changed events** — race between font and theme changes
- [ ] **14. borderCol = neutral4 too dark in light theme** — defeats rim contrast
- [ ] **15. gradPair flips track gradient** — light theme track darker than expected
- [ ] **16. shadowColor same as fillStyle** — shape body overwrites its own blur pixels
- [ ] **17. canvas color parsing** — canvas may not accept all color string formats
- [ ] **18. dataset.theme read timing** — JS reads before app.js sets it
- [ ] **19. No clip path** — shadow bleeds outward instead of only inward
- [ ] **20. Fundamental approach mismatch** — canvas shadowBlur ≠ CSS box-shadow inset
