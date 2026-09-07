# ARKA — Architecture

A browser arkanoid built in TypeScript on a single `<canvas>` 2D context. No engine, no DOM
game objects, no save system. Everything visible — bricks, paddle, ball, background, HUD,
menus, buttons and every glyph of text — is drawn by our own code into the canvas.

---

## 1. Design constraints (from the brief)

| Constraint | Consequence in this design |
|---|---|
| TypeScript app | Vite + strict TS, zero runtime framework |
| All graphics in canvas | One canvas, layered offscreen buffers, no HTML UI |
| Retro look, **not** heavy pixelation | Crisp vector geometry at full device resolution; the retro reading comes from a locked palette, ordered dithering and CRT-ish post pass — **not** from a low-res upscaled buffer |
| Stylized fonts and interactive elements | Custom polyline glyph font drawn stroke-by-stroke; buttons/sliders/toggles are canvas widgets with our own hit-testing |
| Realistic physics | Fixed-timestep integrator + continuous (swept) collision, restitution, spin, paddle english |
| Procedural levels | Seeded PRNG, several generator archetypes, solvability validation |
| Parallax background | 4 scrolling depth layers, cached to offscreen canvases |
| Dither gradients | Pre-baked 8×8 Bayer threshold tiles turned into `CanvasPattern`s — never per-pixel per frame |
| Fancy destruction | Per-brick shard fracture + dust + shockwave + flash + screen shake |
| Different block types | Seven behaviours (§6) |
| Win / lose conditions | Clear all destructible bricks to advance; lives reach zero to end |
| Score system | Base × type × combo × level, in-memory only |
| No sounds yet | An `Audio` seam exists as an interface with a no-op implementation, so adding sound later touches one file |
| No save system | No `localStorage`, no server, no persistence of any kind |

**Assumptions we had to make** (the brief said "different types of blocks … etc." without
naming them): the seven block behaviours in §6, the seven-colour palette in §3, and the level
archetypes in §7 are our choice. They are the parts of the spec that were left open; everything
else follows the brief literally.

---

## 2. Runtime shape

```
index.html  ──▶  src/main.ts
                   │
                   ├── core/Loop          fixed-step accumulator, RAF, pause on blur
                   ├── core/Input         keyboard + pointer, normalized to canvas space
                   ├── core/Viewport      DPR-aware sizing, letterboxed 16:9 play field
                   ├── core/Rng           seeded sfc32, deterministic per level
                   │
                   ├── app/Game           top-level state machine
                   │     states: Boot → Title → Playing → LevelClear → GameOver
                   │
                   ├── game/World         entities + rules for one level
                   │     Ball, Paddle, Brick[], Field bounds
                   │
                   ├── physics/            swept circle-vs-AABB, speed/angle constraints
                   ├── level/              procedural generation + validation
                   ├── fx/                 particles, shards, shake, flashes
                   ├── render/             painters + dither + palette + glyph font
                   └── ui/                 canvas widgets, HUD, screens
```

There is **one** update path and **one** draw path. `Game.update(dt)` is pure simulation;
`Game.draw(ctx, alpha)` never mutates state. `alpha` is the sub-step interpolation factor so
motion stays smooth on displays that are not an exact multiple of the sim rate.

### Timing

- Simulation runs at a **fixed 120 Hz** (`DT = 1/120`).
- An accumulator drains at most 5 steps per frame; beyond that we drop time (no spiral of death).
- Rendering happens once per `requestAnimationFrame` with positional interpolation.
- The loop stops on `visibilitychange` and on window blur, and resumes without a time spike.

### Shutdown

`Game.dispose()` cancels the RAF handle, removes every listener and drops the offscreen
buffers. It is wired to `beforeunload` and `pagehide`, so the run loop never survives its page.

---

## 3. Look: palette, dither, post

### 3.1 Palette

A locked 24-entry palette, authored as three ramps plus accents. Nothing in the game may use a
colour that is not in `render/palette.ts`. This single rule is what makes a hand-drawn canvas
game read as "retro" without pixelation.

```
VOID    #07060f  #0d0b1c  #141232  #1d1a47   deep space → field floor
STEEL   #2b2f52  #3d4470  #566093  #7b86b8   structure, chrome, UI frames
EMBER   #ff5d4a  #ff8a3d  #ffc24b  #fff2b8   hits, explosions, score pops
NEON    #2de2c8  #29b8e6  #6a7cff  #b98cff   ball, paddle, glass, glow
BONE    #cfd6ff  #eef1ff  #ffffff            text, highlights, sparks
```

Ramps are ordered, so "one step darker" is a palette index operation — used everywhere for
bevels, shadows and hit flashes.

### 3.2 Ordered dithering

Gradients are the main source of "cheap 2010s web game" looks, so we never draw a smooth
`createLinearGradient`. Instead:

1. An 8×8 **Bayer** threshold matrix (recursive van der Corput construction — see [ordered
   dithering](https://en.wikipedia.org/wiki/Ordered_dithering)) gives a per-pixel threshold in
   `[0,1)`.
2. For a two-colour ramp we bake **17 tiles** (mix levels 0/16 … 16/16). Each tile is an 8×8
   `ImageData` where pixel `p` takes colour B if `level/16 > bayer[p]`, else A.
3. Each tile becomes a repeating `CanvasPattern`, cached by `(colourA, colourB, level)`.
4. A dithered vertical gradient is then N horizontal bands, each filled with the pattern whose
   level matches that band's mix. Bands are 4–12 px; the Bayer noise hides the banding.

Cost: pattern generation happens once at boot (a few hundred 8×8 buffers, well under a
millisecond of work each); per frame it is plain `fillRect` calls. This is the whole reason the
effect is affordable.

Radial and angular dithers use the same tile cache with a clip path.

### 3.3 Post pass

A single cheap pass over the composited frame, all optional and individually toggleable:

- **Bloom** — the bright-pass layer is drawn to a quarter-size buffer, box-blurred twice, then
  composited back with `lighter`. Quarter-size keeps it ~1/16 the fill cost.
- **Scanlines** — one cached 1×4 pattern, `multiply`, ~6% strength.
- **Vignette** — cached dithered radial, drawn once into a buffer, reused.
- **Chromatic pulse** — on big hits only, the frame's red and blue channels are re-drawn at a
  ±1–3 px offset for a few frames.

Every post element is a cached buffer or pattern. Nothing is recomputed per frame.

### 3.4 Type

`render/glyphs.ts` holds glyphs as **polylines on a 5×7 unit grid**, with 1.6-unit corner
chamfers giving the letterforms their angular arcade-marquee shape. `render/text.ts` strokes
them with `lineJoin/lineCap = "round"` at any size, so text is resolution-independent rather
than a pixel bitmap. Three weights (stroke width) and an italic shear cover headings, HUD and
body copy without a second glyph set. Kerning is a sparse per-pair table over a fixed advance.
Uppercase only, by design; lowercase input is folded at draw time.

Text is drawn through `drawText(ctx, str, opts)` which supports letter-spacing, a hard
drop-shadow offset, and a dithered fill for large display type.

---

## 4. Physics

The ball is small and fast, and the bricks are thin — the naive "move then test overlap"
approach tunnels straight through them. So collision is **continuous**.

### 4.1 Integration

Semi-implicit Euler on a fixed step. The ball carries `pos`, `vel`, `radius`, `spin`.
Forces: none by default (no gravity on the ball), plus a Magnus-style lateral acceleration
`a = k · spin · perp(vel̂)` that decays with `spin *= 0.985` per step. Shards and particles
*do* get gravity — they are decorative and use plain discrete integration.

### 4.2 Swept circle vs AABB

For one sub-step the ball traces a segment `P → P + v·dt`. Testing a moving circle against a
static box is equivalent to testing that **segment against the box's Minkowski expansion by the
ball radius**: the box grown by `r` on each side, with the four corners rounded to radius `r`
([Hamaluik, *Swept AABB via the Minkowski
difference*](https://blog.hamaluik.ca/posts/swept-aabb-collision-using-minkowski-difference/);
[Feronato, *Swept AABB and Minkowski
sum*](https://emanueleferonato.com/2021/10/21/understanding-physics-continuous-collision-detection-using-swept-aabb-method-and-minkowski-sum/);
[GameDev.net, *Swept AABB collision detection and
response*](https://www.gamedev.net/articles/programming/general-and-gameplay-programming/swept-aabb-collision-detection-and-response-r3084/)).

`sweptCircleAabb(p, d, box, r)` therefore returns the earliest of:

- **slab test** against the expanded box for the four face regions → normal is an axis;
- **segment vs circle** at each of the four corners, radius `r` → normal is `hit − corner`.

Result is `{ t ∈ [0,1], normal, kind }` or `null`. Faces are tested before corners and win ties,
which avoids the classic "ball squeezed between two adjacent bricks pops out sideways" artefact.

### 4.3 Resolution loop

The loop lives in `game/World.advanceBall`, not in `physics/`: taking the earliest contact is
inseparable from deciding what that contact *means* — damage, score, an explosive chain, a
glass pass-through — so splitting it would just push the same coupling across a seam.

Per sim step, up to **4** iterations:

1. Sweep against every candidate brick, both side walls, the ceiling, and the paddle.
2. Candidates come from the **brick grid index** — bricks live in a fixed grid, so we only test
   the cells the sweep's bounding box touches. No broad-phase tree needed.
3. Take the smallest `t`. Advance to `t·(1−ε)`, reflect: `v ← v − (1+e)(v·n)n` with restitution
   `e = 0.995` for walls and bricks. Glass is the exception: it takes damage and the ball keeps
   its velocity, nudged past the plate so the same brick cannot be re-hit inside one step.
4. Consume the remaining `(1−t)` of the step and repeat.
5. Notify the hit target (brick takes damage, paddle applies english).

Anti-degeneracy guards, all in `physics/constraints.ts`:

- **speed clamp** to `[minSpeed, maxSpeed]` after every reflection;
- **min vertical component**: if `|v.y| < 0.22·|v|`, rotate the vector away from horizontal, so
  the ball can never grind along the ceiling forever;
- **stuck detector**: if 4 iterations are exhausted in one step, nudge the ball along the last
  normal by `2ε` and zero the tangential component.

### 4.4 Paddle

The paddle is an AABB with rounded visual caps and a real horizontal velocity (it is
position-driven by pointer/keys through a critically-damped spring, so it has inertia and can
impart it). On contact:

- reflection normal is the face normal, **bent** by up to 60° toward the edges based on the
  normalized hit offset `u ∈ [−1,1]` — this is the classic arkanoid steering and it is what
  makes the game controllable;
- the paddle's own velocity adds tangential speed (`v.x += 0.35·paddleVx`) and **spin**
  (`spin += 0.02·paddleVx`), which then curves the ball via §4.1;
- speed increases by 1.5% per paddle hit, capped, so rallies get tenser.

---

## 5. Level generation

`level/generate.ts` takes `(levelIndex, seed)` and returns a `LevelSpec`: a grid of
`BrickKind | null` plus per-level tuning (ball speed, paddle width, background variant).

Randomness is a **seeded sfc32** (`core/Rng`) so a level index + seed always reproduces the same
layout — needed for deterministic tests, and it means we never store a level, only its seed.

### Archetypes

Each level picks an archetype weighted by `levelIndex`:

1. **Mirror** — generate the left half with weighted noise, reflect it. Reliable, readable.
2. **Rings** — concentric rounded rectangles / arcs with gaps.
3. **Automaton** — random fill at density `d`, then 3 generations of a B678/S345678 cellular
   smoothing rule; produces organic caverns.
4. **Lattice** — diagonal weave with steel nodes at the crossings.
5. **Sentinel** — a dense core wrapped in reinforced shell, explosive seeds inside.

### Post-passes, in order

1. **Kind assignment** — a per-level budget picks how many reinforced / steel / explosive /
   glass / regenerating / mirror bricks the layout gets, then places them by rule (steel prefers
   structural positions, explosives prefer dense neighbourhoods, glass prefers edges).
2. **Solvability validation** — flood-fill from the open space below the field. Every
   *destructible* brick must be reachable by a straight ray from reachable space, or adjacent to
   a destructible neighbour that is. If not, that brick is downgraded to standard or removed.
   Steel is additionally capped so it can never fully wall off a region.
3. **Difficulty check** — total HP must land inside a target band for the level index;
   otherwise nudge density and regenerate (max 8 tries, then accept).

### Difficulty curve

`level 1 → ∞`: ball speed `380 + 14·√level` px/s (capped 780), paddle width `120 − 3·level`
(floor 72), brick rows `4 + ⌊level/3⌋` (cap 9), and the exotic-kind budget grows from 0 to ~35%
of the layout. Every 5th level is a **set piece**: a fixed archetype with a higher steel count
and a wider paddle, to break the rhythm.

---

## 6. Block types

| Kind | HP | Behaviour | Score | Visual |
|---|---|---|---|---|
| **Standard** | 1 | plain break | 100 | flat face, dithered bevel, palette hue by row |
| **Reinforced** | 3 | cracks at each HP step | 250 | steel plate, rivets, crack overlay grows |
| **Steel** | ∞ | indestructible; part of the structure | 0 | chrome with a dithered specular sweep, sparks on hit |
| **Explosive** | 1 | on break, detonates a 1.6-brick radius, chains with a 60 ms delay | 300 + chain | pulsing ember core, warning glow when neighbours die |
| **Glass** | 1 | ball passes **through** without reflecting; shatters into 3× the shards | 150 | near-transparent, dithered refraction, bright rim |
| **Regenerating** | 1 | rebuilds after 8 s unless the level is already clear; max 3 rebuilds | 120 each | wireframe ghost while rebuilding, scanline wipe on return |
| **Mirror** | 2 | 45° angled face: reflects along its diagonal, not the axis | 200 | angled chrome wedge, high-contrast diagonal dither |

Win condition ignores Steel and counts a Regenerating brick as cleared once it is out of
rebuilds. Lose condition is lives reaching zero.

---

## 7. Destruction

`fx/Fracture` turns a brick rect into shards by **recursive random splitting**: pick the longer
axis, cut at `0.5 ± 0.18` jitter, recurse to depth 3 → 6–10 convex quads. Each shard gets:

- velocity = `impactNormal·(140…320)` + outward-from-centre spread + inherited ball speed × 0.3;
- angular velocity from its offset relative to the impact point;
- gravity `1400 px/s²`, air drag `0.99`, and it dies on leaving the field or after 1.4 s;
- its face colour from the parent brick, one palette step darker on the trailing edge, so
  tumbling shards flicker.

Layered on top, all pooled: **dust** (dithered soft quads, additive), **spark** streaks (short
tapered lines along the impact normal), a **shockwave** ring (expanding dithered annulus,
2 frames of `lighter`), a **hit flash** (brick silhouette in BONE for 1 frame), **screen shake**
(decaying 2D noise offset, capped at 7 px), and a **chromatic pulse** for explosive chains.

Every particle system is a **fixed-capacity typed-array pool** — no per-frame allocation, no GC
sawtooth. Caps: 2200 shards, 3000 dust, 800 sparks, 48 shockwave rings, 64 score pops. Overflow
overwrites the oldest via a rotating cursor — deterministic, so replaying a seed replays the
frame exactly.

---

## 8. Parallax background

Four layers, each an offscreen canvas rendered once per level (or once per resize):

| Layer | Depth factor | Content |
|---|---|---|
| 0 sky | 0.02 | full-field dithered vertical gradient + a slow nebula (3 blurred dithered radials) |
| 1 far | 0.10 | starfield: 400 points, 3 sizes, twinkle by a cheap hash of `(index, time)` |
| 2 mid | 0.28 | silhouette skyline generated from the level seed — towers, arches, antennae |
| 3 near | 0.55 | structural struts + a dithered haze band that catches the ball's glow |

Offsets track a camera that follows `0.06 × (ballX − centre)` plus a constant slow drift, so the
field breathes without making the player seasick. Layers are drawn with a single `drawImage`
each and wrap horizontally.

---

## 9. UI

No HTML controls anywhere. `ui/Widget` is a tiny retained-mode tree: each widget has a rect, a
draw function, and optional `onPress`. `WidgetTree` hit-tests top-down each frame and tracks
hover/active, so buttons have real press states and keyboard focus works (`Tab`/arrows/Enter).

Widgets provided: **Button** (bevelled plate, dithered face, hover sheen, real press travel),
**Slider** (notched track, chunky thumb, drag / click-to-jump / arrow keys), **Toggle**
(sliding chrome block in a notched channel), and **Panel** (framed, dithered, corner brackets
and a title tab).

Screens: Title, Options, Pause, LevelClear (score breakdown, counting up), GameOver.
HUD: score (odometer roll), lives (paddle glyphs), level, combo meter, and floating score pops.

---

## 10. Score

```
brickScore   = base(kind) × comboMultiplier × levelMultiplier
comboMult    = 1 + 0.1 × min(combo, 30)        combo = bricks broken since last paddle touch
levelMult    = 1 + 0.05 × (level − 1)
levelClear   = 1000 × level
               + timeBonus  = max(0, 60 − seconds) × 25
               + flawless   = 2500 if no life lost this level
```

The combo meter drains visually as the ball approaches the paddle, which is the entire reason
players will try to keep rallies going. Scores exist for the session only — nothing is stored.

---

## 11. Performance budget

Target: 60 fps at 1920×1080 on integrated graphics, ≤ 8 ms per frame.

- Background: 4 `drawImage` calls. Rebuilt only on level change or resize.
- Bricks: one `fillRect`-based painter per brick, ~120 bricks worst case. Faces and bevels use
  cached dither patterns, so no gradient objects are created per frame.
- A brick's rendered appearance is cached to a small offscreen canvas keyed by
  `(kind, hp, width, height)` — there are at most a few dozen distinct combinations, so bricks
  are `drawImage` blits, not procedural draws, once warm.
- Particles: typed-array pools, drawn in batched paths grouped by colour and blend mode.
- Post: bloom at quarter resolution; everything else a cached pattern.
- No allocation in the hot path: vectors are mutated in place, `Vec2` helpers all take an out
  parameter, and collision results are reused structs.
- Bounded memory: pattern cache is LRU-capped at 512 entries, brick-appearance cache at 128.

`core/Profiler` (dev only, toggled with `F3`) shows a frame-time graph, entity counts and
draw-call counts.

---

## 12. Testing

Vitest, `run` mode only (never watch, so nothing lingers).

- `physics/swept.test.ts` — analytic cases: head-on face hit, corner grazes, exact tangent,
  zero velocity, ball starting inside a box, face-beats-corner tie-breaking, and a high-speed
  pass that *must not* tunnel.
- `physics/constraints.test.ts` — speed clamp, shallow-angle escape, energy preservation.
- `core/Rng.test.ts` — stream determinism, range bounds, distribution flatness, weighting.
- `level/generate.test.ts` — determinism for a fixed seed, the solvability invariant over 200
  seeds, HP inside the difficulty band, a steel cap, and no fully-enclosed destructibles.
- `render/dither.test.ts` — Bayer matrix is a permutation of 0…63 and tiles at 0.5 mean.
- `game/Score.test.ts` — combo, level and bonus arithmetic.
- `game/World.test.ts` — the integration layer, with no canvas: starting a run, loading a
  generated level, ball containment over a 20 s rally, per-kind brick behaviour for all seven
  types, life loss, game over, level clear and awarded score. This is the suite that catches
  wiring mistakes, which rendering correctly tells you nothing about.

Canvas output is not unit tested. It is verified by driving the built bundle in a real browser
and reading the canvas back — see the Status section of ROADMAP.md for what that covered.

---

## 13. Directory layout

```
arka/
├── docs/
│   ├── ARCHITECTURE.md          this file
│   └── ROADMAP.md               phased build order
├── public/
├── index.html
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── app/        Game state machine, screens wiring
│   ├── core/       Loop, Input, Viewport, Rng, Profiler, Audio (no-op seam)
│   ├── math/       vec2, aabb, scalar, easing
│   ├── physics/    swept, constraints
│   ├── game/       Ball, Paddle, Brick, BrickGrid, World, kinds, field, Score
│   ├── level/      generate, archetypes, kinds, validate, tuning
│   ├── fx/         Fracture, Particles, Shake
│   ├── render/     palette, dither, glyphs, text, shapes, painters/, Background, Post
│   └── ui/         Widget, widgets/, screens/, Hud
├── Dockerfile
├── .dockerignore
├── .gitignore
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 14. References

- [Ordered dithering — Bayer matrix construction](https://en.wikipedia.org/wiki/Ordered_dithering)
- [Swept AABB collision detection using the Minkowski difference — Hamaluik](https://blog.hamaluik.ca/posts/swept-aabb-collision-using-minkowski-difference/)
- [Understanding continuous collision detection using swept AABB and Minkowski sum — Feronato](https://emanueleferonato.com/2021/10/21/understanding-physics-continuous-collision-detection-using-swept-aabb-method-and-minkowski-sum/)
- [Swept AABB collision detection and response — GameDev.net](https://www.gamedev.net/articles/programming/general-and-gameplay-programming/swept-aabb-collision-detection-and-response-r3084/)
- [Moving circle to AABB collision (corner handling) — GameDev.net forums](https://gamedev.net/forums/topic/697884-moving-circle-to-aabb-collision/)
- [Fix Your Timestep! — Gaffer On Games](https://gafferongames.com/post/fix_your_timestep/)
