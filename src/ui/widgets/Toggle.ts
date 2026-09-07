import { setDitherFill } from "../../render/dither";
import { BONE, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { pathChamferRect, strokeCornerBrackets } from "../../render/shapes";
import { drawText } from "../../render/text";
import { Widget } from "../Widget";

/** Sliding chrome block in a notched channel. The native checkbox is nowhere near this. */
export class Toggle extends Widget {
  label: string;
  value: boolean;
  onChange: ((value: boolean) => void) | undefined;
  private knob = 0;

  constructor(x: number, y: number, w: number, h: number, label: string, value: boolean) {
    super(x, y, w, h);
    this.label = label;
    this.value = value;
    this.knob = value ? 1 : 0;
    this.onPress = () => {
      this.value = !this.value;
      this.onChange?.(this.value);
    };
  }

  override update(
    pointer: { x: number; y: number; down: boolean; pressed: boolean; released: boolean },
    focused: boolean,
    dt: number,
  ): boolean {
    const consumed = super.update(pointer, focused, dt);
    this.knob += ((this.value ? 1 : 0) - this.knob) * Math.min(1, dt * 16);
    return consumed;
  }

  override draw(ctx: CanvasRenderingContext2D, focused: boolean, time: number): void {
    const { x, y, w, h } = this.rect;
    const trackW = 62;
    const trackH = h * 0.62;
    const trackX = x + w - trackW;
    const trackY = y + (h - trackH) * 0.5;

    drawText(ctx, this.label, x, y + h * 0.5 - h * 0.19, {
      size: h * 0.38,
      color: BONE[1],
      weight: "regular",
      tracking: 0.16,
      alpha: this.enabled ? 0.9 : 0.4,
    });

    ctx.save();
    // Channel.
    pathChamferRect(ctx, trackX, trackY, trackW, trackH, 5);
    ctx.save();
    ctx.clip();
    setDitherFill(ctx, VOID[0], this.value ? NEON[1] : STEEL[0], 0.2 + this.knob * 0.5);
    ctx.fillRect(trackX, trackY, trackW, trackH);
    ctx.fillStyle = withAlpha(VOID[0], 0.4);
    for (let i = 4; i < trackW; i += 6) ctx.fillRect(trackX + i, trackY, 1, trackH);
    ctx.restore();
    ctx.strokeStyle = withAlpha(BONE[2], 0.3);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Knob.
    const knobW = trackW * 0.46;
    const kx = trackX + 2 + (trackW - knobW - 4) * this.knob;
    pathChamferRect(ctx, kx, trackY - 2, knobW, trackH + 4, 4);
    ctx.save();
    ctx.clip();
    setDitherFill(ctx, STEEL[1], BONE[2], 0.5 + this.hoverBlend * 0.3);
    ctx.fillRect(kx, trackY - 2, knobW, trackH + 4);
    ctx.restore();
    ctx.strokeStyle = withAlpha(BONE[2], 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (focused) {
      strokeCornerBrackets(
        ctx,
        trackX - 6,
        trackY - 8,
        trackW + 12,
        trackH + 16,
        9,
        withAlpha(NEON[0], 0.6 + 0.35 * Math.sin(time * 6)),
        2,
      );
    }
    ctx.restore();
  }
}
