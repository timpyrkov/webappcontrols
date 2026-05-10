# PLAN — Volume-style Rotary Knob

A new visual variant of `<rotary-knob>` for the **"Volume"** style mode, inspired
by a studio-grade hardware knob: pale silver bezel + dark knurled grip ring +
recessed groove + domed black cap + accent-gradient pointer with pivot dot.

The Flat / Basic / Gradient knob renderings must remain **untouched**. Theme
adaptation (Dark ↔ Light) follows the same pattern as the existing Volume-mode
gauges in `gauges.js`: use `gradPair()` from `tokens.js` to swap neutral
gradient stops, and `nicheColors()` for niche rim/depth glow.

---

## Phase 1 — Wiring (entry points & toggling)

- [x] In `public/js/app.js` extend the `volume` attribute toggle from
      `circular-gauge, linear-gauge` to **also include `rotary-knob`**.
- [x] In `public/js/controls/rotary-knob.js`:
      - [x] Add `"volume"` to `observedAttributes`.
      - [x] Add `_volume` flag set in `_readAttributes()`.
      - [x] Branch in `_draw()` to call a new `_drawVolume()` when the flag is
            set; otherwise keep the existing pipeline.

## Phase 2 — Volume drawing implementation

Layered painting (outside → inside) inside `_drawVolume(ctx, cx, cy, S)`:

- [x] **Drop-shadow halo** under the bezel (soft `shadowBlur`, top-down light).
- [x] **Pale outer bezel ring** — `gradPair(neutral-9, neutral-7)` linear
      gradient, ~3 px ring at radius `VOL_BEZEL_R`.
- [x] **Knurled grip ring** — alternating thin radial slices
      `gradPair(neutral-5, neutral-2)` between `VOL_KNURL_OUTER_R` and
      `VOL_KNURL_INNER_R`. ~44 ticks (configurable).
- [x] **Recessed groove shadow** — 1-2 px stroked ring darker than knurl base
      (`neutral-1`) at `VOL_GROOVE_R`.
- [x] **Domed cap** — radial gradient (light at top, dark at center)
      simulating a convex dome at `VOL_CAP_R`.
      Use `nicheColors()` rim glow above for theme-aware highlight.
- [x] **Pointer line** — same length/offset as today, painted with an
      `accent-3 → accent-1` gradient.
- [x] **Pivot dot** — small filled circle at the cap center (accent-1).
- [x] **Continuous arc indicator** — keep the existing
      `_drawArcContinuous` at `ARC_R` (sits outside the bezel).
- [x] **Enum labels** — keep the existing `_drawEnumLabels`.
- [x] **Caption** — keep the existing `_drawCaption`.

## Phase 3 — Theme adaptation

- [x] All neutral gradients use `gradPair()` so Light theme inverts.
- [x] Pointer + pivot use accent tokens (theme-independent on top).
- [x] Niche rim/depth glow uses `nicheColors()` for parity with gauges.

## Phase 4 — Layout constants (Volume-specific)

Defined near the top of `rotary-knob.js`:

- [x] `VOL_BEZEL_OUTER_R`, `VOL_BEZEL_INNER_R`
- [x] `VOL_KNURL_OUTER_R`, `VOL_KNURL_INNER_R`, `KNURL_TICKS`
- [x] `VOL_GROOVE_R`
- [x] `VOL_CAP_R`

These map onto the existing `OUTER_R = 0.30` / `INNER_R = 0.22` envelope so
nothing in the hosting layout shifts.

## Phase 5 — Verification (manual, in-browser)

- [ ] Toggle through all 4 styles → Flat/Basic/Gradient knobs are pixel-identical
      to before.
- [ ] Toggle Dark/Light theme in Volume mode → bezel/cap invert sensibly.
- [ ] Verify enum-mode and continuous-mode both render correctly.
- [ ] Confirm interaction (drag/click) is unaffected.
- [ ] Inspect performance during animation; if knurl is slow, replace with a
      static smooth dark ring (fallback path is a one-line swap of the
      knurl loop with a single linear-gradient annulus fill).

---

## Open decisions (accepted by user)

1. **Theme behaviour** — follow the existing Volume-mode gauge pattern
   (`gradPair` + `nicheColors`) rather than "always-dark hardware look".
2. **Knurl** — implement first; fall back to a smooth ring if performance is
   poor.
3. **Sizes** — adapt freely to fit the existing knob size envelope rather than
   replicating the reference image pixel-perfectly.
