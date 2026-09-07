import { DESIGN_H, DESIGN_W } from "../core/Viewport";
import { VOID, withAlpha } from "./palette";
import { fillDitherRadial } from "./dither";

export interface PostOptions {
  bloom: boolean;
  scanlines: boolean;
  vignette: boolean;
  chromatic: boolean;
}

/** Quarter resolution: the blur costs a sixteenth of the fill and nobody can tell. */
const BLOOM_DIV = 4;

/**
 * Composite pass. Everything here is either a cached pattern or a quarter-resolution buffer;
 * nothing walks pixels per frame, which is what keeps the whole look inside the frame budget.
 */
export class Post {
  private bloomA: CanvasRenderingContext2D | undefined;
  private bloomB: CanvasRenderingContext2D | undefined;
  private vignetteCanvas: HTMLCanvasElement | undefined;
  private scanPattern: CanvasPattern | undefined;

  private surface(w: number, h: number): CanvasRenderingContext2D {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Post: 2D context unavailable");
    return ctx;
  }

  private ensure(ctx: CanvasRenderingContext2D): void {
    if (!this.bloomA) {
      this.bloomA = this.surface(DESIGN_W / BLOOM_DIV, DESIGN_H / BLOOM_DIV);
      this.bloomB = this.surface(DESIGN_W / BLOOM_DIV, DESIGN_H / BLOOM_DIV);
    }
    if (!this.vignetteCanvas) {
      const v = this.surface(DESIGN_W, DESIGN_H);
      // A dithered radial punched out of a dark plate: darkens the corners, keeps the centre.
      // The radius must clear the frame diagonal, or the punch-out leaves a hard disc edge
      // with fully opaque corners — which reads as a black circle, not a vignette.
      v.fillStyle = VOID[0];
      v.fillRect(0, 0, DESIGN_W, DESIGN_H);
      v.globalCompositeOperation = "destination-out";
      fillDitherRadial(
        v,
        DESIGN_W * 0.5,
        DESIGN_H * 0.5,
        Math.hypot(DESIGN_W, DESIGN_H) * 0.62,
        "#ffffff",
        "#000000",
        17,
      );
      this.vignetteCanvas = v.canvas;
    }
    if (!this.scanPattern) {
      const s = this.surface(1, 4);
      s.fillStyle = "rgba(0,0,0,0.16)";
      s.fillRect(0, 0, 1, 1);
      s.fillStyle = "rgba(0,0,0,0.05)";
      s.fillRect(0, 2, 1, 1);
      const p = ctx.createPattern(s.canvas, "repeat");
      if (p) this.scanPattern = p;
    }
  }

  /**
   * `source` is the already-composited frame in design space. `chroma` in 0..1 drives the
   * channel-split pulse used on explosive chains and lost lives.
   */
  apply(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    options: PostOptions,
    chroma: number,
  ): void {
    this.ensure(ctx);

    if (options.chromatic && chroma > 0.01) {
      const off = chroma * 3;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.4;
      // Two offset copies at low alpha read as an RGB split without a shader.
      ctx.drawImage(source, -off, 0);
      ctx.drawImage(source, off, 0);
      ctx.restore();
    }

    if (options.bloom) this.drawBloom(ctx, source);

    if (options.vignette && this.vignetteCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.vignetteCanvas, 0, 0);
      ctx.restore();
    }

    if (options.scanlines && this.scanPattern) {
      ctx.save();
      ctx.fillStyle = this.scanPattern;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.restore();
    }
  }

  private drawBloom(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement): void {
    const a = this.bloomA;
    const b = this.bloomB;
    if (!a || !b) return;
    const w = a.canvas.width;
    const h = a.canvas.height;

    a.setTransform(1, 0, 0, 1, 0, 0);
    a.clearRect(0, 0, w, h);
    a.drawImage(source, 0, 0, w, h);

    // Bright pass: multiplying the frame against itself twice raises it to the fourth power,
    // which crushes the mid-tones hard enough that only near-white survives. One multiply
    // leaves too much of the background in, and the whole frame washes out.
    a.save();
    a.globalCompositeOperation = "multiply";
    a.drawImage(a.canvas, 0, 0);
    a.drawImage(a.canvas, 0, 0);
    a.restore();

    // Two box passes, each a four-tap offset draw. Cheaper than a separable kernel at this
    // resolution and visually indistinguishable once composited back at 30% alpha.
    for (let pass = 0; pass < 2; pass++) {
      const src = pass === 0 ? a : b;
      const dst = pass === 0 ? b : a;
      dst.setTransform(1, 0, 0, 1, 0, 0);
      dst.clearRect(0, 0, w, h);
      dst.globalAlpha = 0.25;
      const d = 1 + pass;
      dst.drawImage(src.canvas, -d, 0);
      dst.drawImage(src.canvas, d, 0);
      dst.drawImage(src.canvas, 0, -d);
      dst.drawImage(src.canvas, 0, d);
      dst.globalAlpha = 1;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.32;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(a.canvas, 0, 0, DESIGN_W, DESIGN_H);
    ctx.restore();
  }

  /** Dithered wipe used for screen and level transitions. `t` runs 0 (clear) to 1 (opaque). */
  static wipe(ctx: CanvasRenderingContext2D, t: number, color = VOID[0]): void {
    if (t <= 0) return;
    const bands = 18;
    ctx.save();
    for (let i = 0; i < bands; i++) {
      const local = Math.min(1, Math.max(0, t * 1.6 - (i / bands) * 0.6));
      ctx.fillStyle = withAlpha(color, local);
      ctx.fillRect(0, (DESIGN_H * i) / bands, DESIGN_W, DESIGN_H / bands + 1);
    }
    ctx.restore();
  }

  dispose(): void {
    this.bloomA = undefined;
    this.bloomB = undefined;
    this.vignetteCanvas = undefined;
    this.scanPattern = undefined;
  }
}
