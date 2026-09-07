import { Rng, hashSeed } from "../core/Rng";
import { DESIGN_H, DESIGN_W } from "../core/Viewport";
import { hash21 } from "../math/scalar";
import { fillDitherRadial, fillDitherV, setDitherFill } from "./dither";
import { EMBER, NEON, STEEL, VOID, mixHex, withAlpha } from "./palette";

/** Extra width per layer so it can scroll without exposing an edge. */
const OVERSCAN = 260;
const STARS = 460;

interface Layer {
  canvas: HTMLCanvasElement;
  depth: number;
}

/**
 * Four parallax layers, each rasterized once per level into its own offscreen canvas. The
 * per-frame cost is therefore four `drawImage` calls regardless of how elaborate the art is —
 * which is the only way dithered gradients and a few hundred stars are affordable at 60 fps.
 */
export class Background {
  private layers: Layer[] = [];
  private seed = 0;
  private width = 0;
  private height = 0;
  private drift = 0;
  cameraX = 0;

  /** Rebuilds every layer. Called on a level change and on resize, never per frame. */
  build(seed: number): void {
    this.seed = seed;
    this.width = DESIGN_W + OVERSCAN * 2;
    this.height = DESIGN_H;
    this.layers = [
      { canvas: this.paintSky(), depth: 0.02 },
      { canvas: this.paintStars(), depth: 0.1 },
      { canvas: this.paintSkyline(), depth: 0.28 },
      { canvas: this.paintNear(), depth: 0.55 },
    ];
  }

  private surface(): CanvasRenderingContext2D {
    const c = document.createElement("canvas");
    c.width = this.width;
    c.height = this.height;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Background: 2D context unavailable");
    return ctx;
  }

  private paintSky(): HTMLCanvasElement {
    const ctx = this.surface();
    const rng = new Rng(hashSeed(this.seed, 1));
    const hueTop = rng.pick([VOID[2], NEON[3], STEEL[0]]);
    fillDitherV(ctx, 0, 0, this.width, this.height, VOID[0], hueTop, 14);

    // Nebulae: dithered radials at low alpha. Three is enough to break up the gradient.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const cx = rng.range(0, this.width);
      const cy = rng.range(this.height * 0.05, this.height * 0.75);
      const r = rng.range(150, 420);
      ctx.globalAlpha = rng.range(0.06, 0.15);
      const tint = rng.pick([NEON[2], NEON[3], EMBER[0], STEEL[2]]);
      fillDitherRadial(ctx, cx, cy, r, tint, VOID[0], 9);
    }
    ctx.restore();
    return ctx.canvas;
  }

  private paintStars(): HTMLCanvasElement {
    const ctx = this.surface();
    const rng = new Rng(hashSeed(this.seed, 2));
    for (let i = 0; i < STARS; i++) {
      const x = rng.range(0, this.width);
      const y = rng.range(0, this.height * 0.9);
      const tier = rng.weighted([7, 3, 1]);
      const size = tier === 0 ? 1 : tier === 1 ? 1.8 : 2.8;
      ctx.globalAlpha = tier === 0 ? 0.4 : tier === 1 ? 0.7 : 0.95;
      ctx.fillStyle = rng.bool(0.8) ? "#cfd6ff" : (rng.pick([NEON[0], EMBER[2]]));
      ctx.fillRect(x, y, size, size);
      if (tier === 2) {
        // The brightest stars get a cross flare, which reads as a lens rather than a dot.
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x - 3, y + size * 0.5 - 0.5, size + 6, 1);
        ctx.fillRect(x + size * 0.5 - 0.5, y - 3, 1, size + 6);
      }
    }
    ctx.globalAlpha = 1;
    return ctx.canvas;
  }

  private paintSkyline(): HTMLCanvasElement {
    const ctx = this.surface();
    const rng = new Rng(hashSeed(this.seed, 3));
    const base = this.height;
    const near = mixHex(VOID[1], STEEL[0], 0.5);

    let x = -40;
    while (x < this.width + 40) {
      const w = rng.range(40, 130);
      const h = rng.range(90, 330);
      const top = base - h;
      setDitherFill(ctx, VOID[1], near, rng.range(0.15, 0.55));
      ctx.fillRect(x, top, w, h);

      // Roof furniture: an antenna or a stepped cap, so no two towers repeat.
      if (rng.bool(0.45)) {
        const aw = rng.range(2, 5);
        ctx.fillRect(x + w * 0.5 - aw * 0.5, top - rng.range(20, 70), aw, 70);
      }
      if (rng.bool(0.35)) {
        const iw = w * rng.range(0.3, 0.7);
        ctx.fillRect(x + (w - iw) * 0.5, top - rng.range(14, 40), iw, 40);
      }

      // Lit windows.
      ctx.fillStyle = withAlpha(EMBER[2], 0.5);
      const cols = Math.max(1, Math.floor(w / 14));
      const rowsN = Math.max(1, Math.floor(h / 18));
      for (let cc = 0; cc < cols; cc++) {
        for (let rr = 0; rr < rowsN; rr++) {
          if (!rng.bool(0.16)) continue;
          ctx.fillRect(x + 5 + cc * 14, top + 8 + rr * 18, 4, 6);
        }
      }
      x += w + rng.range(-14, 22);
    }

    // Arches spanning gaps, to break the flat tower rhythm.
    ctx.strokeStyle = withAlpha(STEEL[1], 0.55);
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const cx = rng.range(0, this.width);
      const r = rng.range(80, 220);
      ctx.beginPath();
      ctx.arc(cx, base, r, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    return ctx.canvas;
  }

  private paintNear(): HTMLCanvasElement {
    const ctx = this.surface();
    const rng = new Rng(hashSeed(this.seed, 4));

    // Structural struts hanging from the top of the frame.
    for (let i = 0; i < 9; i++) {
      const x = rng.range(0, this.width);
      const w = rng.range(14, 40);
      const h = rng.range(60, 210);
      setDitherFill(ctx, VOID[0], STEEL[0], rng.range(0.2, 0.5));
      ctx.fillRect(x, 0, w, h);
      ctx.fillStyle = withAlpha(STEEL[2], 0.3);
      ctx.fillRect(x, h - 3, w, 3);
      for (let b = 0; b < 3; b++) {
        ctx.fillRect(x + 3, 12 + b * 20, w - 6, 2);
      }
    }

    // Haze band across the lower field, which is what catches the ball glow.
    ctx.globalAlpha = 0.4;
    fillDitherV(
      ctx,
      0,
      this.height * 0.62,
      this.width,
      this.height * 0.38,
      "#07060f",
      STEEL[0],
      10,
    );
    ctx.globalAlpha = 1;
    return ctx.canvas;
  }

  /** Camera follows the ball a little and drifts continuously, so the scene never sits still. */
  update(dt: number, ballX: number): void {
    this.drift += dt * 5;
    const follow = 0.06 * (ballX - DESIGN_W * 0.5);
    this.cameraX += (follow - this.cameraX) * Math.min(1, dt * 3);
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    for (const layer of this.layers) {
      const shift = -(this.cameraX + this.drift) * layer.depth;
      // Keep the layer's offset inside [-2*OVERSCAN, 0] so its left edge is never past 0 and
      // its right edge never short of DESIGN_W. Wrapping into [0, span) instead leaves an
      // uncovered gutter down one side of the frame whenever the camera drifts positive.
      const x = -wrap(shift, OVERSCAN * 2);
      ctx.drawImage(layer.canvas, Math.round(x), 0);
    }
    this.twinkle(ctx, time);
  }

  /**
   * A handful of stars are re-lit each frame on top of the cached layer. Cheap, and it stops
   * the starfield reading as a static bitmap.
   */
  private twinkle(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const t = Math.floor(time * 8);
    for (let i = 0; i < 22; i++) {
      const h = hash21(t, i);
      const x = hash21(i, 11) * DESIGN_W;
      const y = hash21(i, 29) * DESIGN_H * 0.7;
      ctx.globalAlpha = 0.15 + h * 0.5;
      ctx.fillStyle = "#eef1ff";
      const s = 1 + h * 2;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }
}

function wrap(v: number, span: number): number {
  if (span <= 0) return 0;
  const m = v % span;
  return m < 0 ? m + span : m;
}
