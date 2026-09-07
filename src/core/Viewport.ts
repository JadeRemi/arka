import type { Aabb } from "../math/aabb";

export const DESIGN_W = 1280;
export const DESIGN_H = 720;

/**
 * Owns canvas sizing. The game is authored against a fixed 1280x720 design space and drawn
 * through a uniform scale, so layout math never has to think about the real window. Unlike a
 * low-resolution back buffer, the scale is applied to the *transform*, so geometry and glyph
 * strokes stay crisp at any DPR — which is what keeps the retro look from turning into a
 * blurry upscale.
 */
export class Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Device pixels per design unit. */
  scale = 1;
  /** Letterbox offset in device pixels. */
  offsetX = 0;
  offsetY = 0;
  dpr = 1;
  deviceW = 0;
  deviceH = 0;

  private readonly onResize = () => this.resize();
  private observer: ResizeObserver | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Viewport: 2D context unavailable");
    this.ctx = ctx;

    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(canvas);
    }
    window.addEventListener("resize", this.onResize, { passive: true });
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.dpr = dpr;
    this.deviceW = w;
    this.deviceH = h;
    this.scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.offsetX = Math.round((w - DESIGN_W * this.scale) * 0.5);
    this.offsetY = Math.round((h - DESIGN_H * this.scale) * 0.5);
  }

  /** Reset the transform to design space. Call once at the top of every frame. */
  begin(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.deviceW, this.deviceH);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  /** Map a client-space event position into design space. */
  toDesignX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return ((clientX - rect.left) * this.dpr - this.offsetX) / this.scale;
  }

  toDesignY(clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return ((clientY - rect.top) * this.dpr - this.offsetY) / this.scale;
  }

  get bounds(): Aabb {
    return { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H };
  }

  dispose(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    window.removeEventListener("resize", this.onResize);
  }
}
