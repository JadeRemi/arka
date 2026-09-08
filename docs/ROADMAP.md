# ARKA — Roadmap

Build order. Each phase ends in something runnable, so the game is never in a broken
intermediate state. `[x]` marks work that is done.

Definition of done for every phase: `yarn typecheck`, `yarn lint` and `yarn test` are clean, and
`yarn dev` shows the phase's feature working.

---

## Phase 0 — Skeleton

- [x] Vite + strict TypeScript, ESLint + Prettier, Vitest (`run` mode only)
- [x] All dependencies pinned exactly — no `^`, no `~`
- [x] `index.html` with a single full-bleed canvas, no other markup
- [x] `.gitignore`, `README.md`, `LICENSE` (MIT), `Dockerfile` + `.dockerignore`
- [x] `git init`, no commits
- [x] `core/Viewport` — DPR-aware resize, letterboxed 16:9 field, canvas-space pointer mapping
- [x] `core/Loop` — 120 Hz fixed accumulator, RAF render, pause on blur, clean `dispose()`
- [x] `core/Rng` — seeded sfc32
- [x] `math/` — `vec2`, `aabb`, `scalar`, `easing`, all allocation-free
- [x] Verify: window shows a cleared canvas at the right size, clean exit on tab close

## Phase 1 — Look foundation

- [x] `render/palette.ts` — the locked 24-entry palette with ordered ramps
- [x] `render/dither.ts` — Bayer 8×8, 17-level tile bake, LRU `CanvasPattern` cache
- [x] `render/dither` helpers: `fillDitherRectV`, `fillDitherRectH`, `fillDitherRadial`
- [x] `render/glyphs.ts` — polyline glyph set (A–Z, 0–9, punctuation) plus kerning table
- [x] `render/text.ts` — `drawText` with tracking, shadow, dithered display fill
- [x] Tests: Bayer permutation, monotonic mix levels
- [ ] Verify: a test screen showing every glyph and a dithered gradient strip

## Phase 2 — Physics core

- [x] `physics/swept.ts` — `sweptCircleAabb` via Minkowski expansion (faces + rounded corners)
- [x] 4-iteration earliest-TOI resolution loop with restitution (in `game/World`)
- [x] `physics/constraints.ts` — speed clamp, min-vertical-angle escape, stuck nudge
- [x] `game/BrickGrid` — fixed grid index, sweep-bounds cell query
- [x] Tests: face, corner, tangent, inside-start, zero-velocity, no-tunnel at 3000 px/s
- [ ] Verify: a debug scene — ball bouncing in an empty box for 60 s with no escapes

## Phase 3 — Playable core

- [x] `game/Paddle` — damped-spring position from pointer/keys, real velocity, clamped to field
- [x] `game/Ball` — spin, Magnus curve, launch from paddle
- [x] `game/Brick` — kind, HP, damage, break callback
- [x] `game/World` — entities, step order, wall/ceiling/paddle/brick collision wiring
- [x] Paddle english: normal bending to 60°, paddle-velocity transfer, spin, 1.5% speed ramp
- [x] Lose a life on ball out; reset to paddle; 3 lives
- [ ] Verify: a hand-built static brick wall is fully clearable with the mouse

## Phase 4 — Brick types

- [x] Standard, Reinforced (3 HP + cracks), Steel (indestructible)
- [x] Explosive — 1.6-brick radius, 60 ms chained detonation
- [x] Glass — no reflection, pass-through, triple shards
- [x] Regenerating — 8 s rebuild, max 3, suppressed when the level is clear
- [x] Mirror — 45° diagonal reflection normal
- [x] Win condition counts only bricks that can still be cleared
- [ ] Verify: a debug level with one of each; every behaviour observed

## Phase 5 — Procedural levels

- [x] `level/tuning.ts` — the difficulty curve (speed, paddle width, rows, exotic budget)
- [x] `level/archetypes.ts` — Mirror, Rings, Automaton, Lattice, Sentinel
- [x] `level/kinds.ts` — budgeted kind assignment with placement rules
- [x] `level/validate.ts` — reachability flood fill, steel walling-off cap, HP band, retry ≤ 8
- [x] `level/generate.ts` — the composed entry point, seeded and deterministic
- [x] Tests: determinism, solvability over 200 seeds, HP band, no enclosed destructibles
- [x] Verify: generated levels are clearable and distinct (200-seed solvability test)

## Phase 6 — Destruction and feel

- [x] `fx/Fracture` — recursive random split to depth 3, per-shard physics and colour
- [x] `fx/Particles` — pooled dust, sparks, shockwave rings; typed arrays, fixed caps
- [x] `fx/Shake` — decaying noise offset, capped at 7 px
- [x] Hit flash and explosive chromatic pulse (in `fx/Shake` and the brick painter)
- [x] Ball trail (dithered, additive, decaying)
- [ ] Verify: clearing a dense level never allocates in-frame and holds 60 fps

## Phase 7 — Background

- [x] `render/Background` — 4 offscreen layers, seed-driven, rebuilt on level/resize only
- [x] Sky dithered gradient + nebula radials
- [x] Starfield with hash twinkle
- [x] Seed-generated skyline silhouette
- [x] Foreground struts + haze band
- [x] Camera: `0.06 × (ballX − centre)` plus slow drift, horizontal wrap
- [ ] Verify: parallax depth reads correctly; layer rebuild count stays at 1 per level

## Phase 8 — UI and screens

- [x] `ui/Widget` — retained tree with pointer dispatch, hover/active, keyboard focus
- [x] Widgets: Button, Slider, Toggle, Panel — all canvas-drawn, all with real press states
- [x] Screens: Title, Options, Pause, LevelClear, GameOver
- [x] `ui/Hud` — odometer score, life glyphs, level, combo meter, floating score pops
- [x] Full keyboard path: no mouse required to start, pause, or navigate
- [ ] Verify: every screen reachable and every widget operable by both mouse and keyboard

## Phase 9 — Post and polish

- [x] `render/Post` — quarter-res bloom, scanline pattern, dithered vignette, chromatic pulse
- [x] Transitions: dithered wipe between screens and levels
- [x] `core/Profiler` — `F3` overlay: frame graph, entity and draw-call counts
- [x] Options: bloom / scanlines / shake / dither strength toggles
- [ ] Verify: 1920×1080 frame time ≤ 8 ms with post on; all toggles work

## Phase 10 — Hardening

- [x] `Game.dispose()` wired to `pagehide` / `beforeunload`; loop never outlives the page
- [x] Pause on blur and on `visibilitychange`, resume with no time spike
- [ ] Memory: caches LRU-capped and verified stable over a 10-minute run
- [x] `yarn build` under a capped Node heap
- [ ] Docker image builds and serves
- [x] Full pass: typecheck, lint, test, build

---

## Deferred (explicitly out of scope for now)

| Item | Note |
|---|---|
| Sound | `core/Audio` is an interface with a no-op implementation; adding it later touches one file |
| Save / persistence | The brief rules it out. No `localStorage`, no server |
| Laser paddle | Would need a projectile system; the power-up registry has room for it |
| Portrait layout | Portrait shows a rotate prompt rather than a reflowed field |

---

## Status

Phases 0 through 9 are implemented and the game is playable end to end: title → run →
procedurally generated levels → level clear → game over. Phase 10 is partly done; what is
still open is listed below.

**Verified**

- `yarn typecheck`, `yarn lint`, `yarn test` (62 tests) and `yarn build` all pass.
- Simulation covered by integration tests with no canvas: run start, level load, ball
  containment over a 20 s rally, speed clamps, brick destruction, per-kind behaviour for all
  seven types, life loss, game over, level clear and scoring.
- Level generation: determinism per seed, and the solvability invariant over 200 seeds.
- Rendering confirmed by driving the built bundle in a real browser and reading the canvas
  back: the title screen, the field with the HUD, and a mid-rally frame with tumbling shards,
  ball trail and combo meter.

**Open**

- [ ] Frame-time measurement on real hardware at 1920×1080 with post on (the ≤ 8 ms target in
      ARCHITECTURE.md §11 is a budget, not yet a measurement — headless Chrome stops driving
      `requestAnimationFrame`, so it cannot produce a usable number).
- [ ] A 10-minute soak to confirm the pattern and brick-appearance caches stay flat.
- [ ] Docker image build and serve check.
- [ ] Tuning pass on feel: paddle width curve, speed ramp, and how quickly the exotic brick
      budget ramps in.


---

## Phase 11 — Feel, power-ups, presentation, touch

- [x] Move every tunable number into `src/config/feel.ts`; no gameplay file hard-codes one
- [x] `config/blocks.ts` — the block registry, so a new type is one table row plus a painter case
- [x] `config/powerups.ts` — the power-up registry, with effects declared as data
- [x] Retune the curves: `√(level−1)` for ball speed and paddle width, gentler rally ramp,
      rally cool-down so a hot exchange relaxes instead of staying fast
- [x] Derive brick cell height from the field, so the wall fills a real share of the playfield
      instead of a thin strip (level 1 ≈ 37%, level 12 ≈ 64%)
- [x] `game/Drops.ts` — falling capsules, pooled, with sway and a real hitbox
- [x] `game/Effects.ts` — active-effect state, modifiers multiplied, refresh-not-stack,
      opposites cancel
- [x] Multiple balls: pooled ball list, per-ball sweep, a life spent only when the list empties
- [x] Nine power-ups: expand, narrow, slow, fast, disrupt, catch, breaker, extra life, guard
- [x] `render/painters/drops.ts` — capsule art, with hazards pulsing
- [x] HUD: explicit three-row layout, power-up chips that drain and flash, guard floor line
- [x] `ui/screens/LevelIntro.ts` — the archetype card at the top of every level
- [x] Touch: window-level drag tracking, 14 px widget hit margins, on-screen pause control,
      portrait rotate prompt, mobile viewport and `dvh` sizing
- [x] Tests: `Effects.test.ts`, `tuning.test.ts`, and the power-up path in `World.test.ts`
- [x] Verified in a real browser: intro card, capsules, multiball, effect chips, a late level
      with a tall wall and visible steel / mirror / explosive / glass variety

### Open

- [ ] Frame-time measurement on real hardware with post on — still a budget, not a measurement
- [ ] A pass on a real phone: thumb reach, capsule size at that scale, pause-button placement
- [ ] A 10-minute soak to confirm the caches stay flat
- [ ] Docker image build and serve check
