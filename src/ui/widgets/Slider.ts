import { clamp01 } from "../../math/scalar";
import { setDitherFill } from "../../render/dither";
import { BONE, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { pathChamferRect, strokeCornerBrackets } from "../../render/shapes";
import { drawText } from "../../render/text";
import { Widget, type PointerState } from "../Widget";

/** Notched track with a chunky thumb. Drag, click-to-jump, and arrow keys all work. */
export class Slider extends Widget {
  label: string;
  value: number;
  steps: number;
  onChange: ((value: number) => void) | undefined;

  private trackX = 0;
  private trackW = 0;

  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: number,
    steps = 10,
  ) {
    super(x, y, w, h);
    this.label = label;
    this.value = clamp01(value);
    this.steps = steps;
  }

  nudge(delta: number): void {
    this.setValue(this.value + delta / this.steps);
  }

  private setValue(v: number): void {
    const q = Math.round(clamp01(v) * this.steps) / this.steps;
    if (q === this.value) return;
    this.value = q;
    this.onChange?.(q);
  }

  override update(pointer: PointerState, focused: boolean, dt: number): boolean {
    const consumed = super.update(pointer, focused, dt);
    if (this.held && this.trackW > 0) {
      this.setValue((pointer.x - this.trackX) / this.trackW);
    }
    return consumed;
  }

  override draw(ctx: CanvasRenderingContext2D, focused: boolean, time: number): void {
    const { x, y, w, h } = this.rect;
    const labelW = w * 0.44;
    this.trackX = x + labelW;
    this.trackW = w - labelW - 46;
    const trackH = 8;
    const ty = y + (h - trackH) * 0.5;

    drawText(ctx, this.label, x, y + h * 0.5 - h * 0.19, {
      size: h * 0.38,
      color: BONE[1],
      weight: "regular",
      tracking: 0.16,
      alpha: 0.9,
    });

    ctx.save();
    pathChamferRect(ctx, this.trackX, ty, this.trackW, trackH, 3);
    ctx.save();
    ctx.clip();
    setDitherFill(ctx, VOID[0], STEEL[0], 0.35);
    ctx.fillRect(this.trackX, ty, this.trackW, trackH);
    setDitherFill(ctx, NEON[1], BONE[2], 0.45);
    ctx.fillRect(this.trackX, ty, this.trackW * this.value, trackH);
    ctx.restore();
    ctx.strokeStyle = withAlpha(BONE[2], 0.25);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Notches, so a discrete slider reads as discrete.
    ctx.fillStyle = withAlpha(BONE[2], 0.3);
    for (let i = 0; i <= this.steps; i++) {
      const nx = this.trackX + (this.trackW * i) / this.steps;
      ctx.fillRect(nx - 0.5, ty + trackH + 3, 1, 4);
    }

    const thumbX = this.trackX + this.trackW * this.value;
    const tw = 12;
    const th = trackH + 14;
    pathChamferRect(ctx, thumbX - tw * 0.5, ty - 7, tw, th, 3);
    ctx.save();
    ctx.clip();
    setDitherFill(ctx, STEEL[2], BONE[2], 0.5 + this.hoverBlend * 0.35);
    ctx.fillRect(thumbX - tw * 0.5, ty - 7, tw, th);
    ctx.restore();
    ctx.strokeStyle = withAlpha(BONE[2], 0.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    drawText(ctx, `${Math.round(this.value * 100)}%`, x + w, y + h * 0.5 - h * 0.19, {
      size: h * 0.34,
      color: STEEL[3],
      align: "right",
      tracking: 0.14,
    });

    if (focused) {
      strokeCornerBrackets(
        ctx,
        this.trackX - 8,
        ty - 12,
        this.trackW + 16,
        th + 12,
        9,
        withAlpha(NEON[0], 0.6 + 0.35 * Math.sin(time * 6)),
        2,
      );
    }
    ctx.restore();
  }
}
