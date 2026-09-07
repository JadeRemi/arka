import { setDitherFill } from "../../render/dither";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { pathChamferRect, strokeCornerBrackets } from "../../render/shapes";
import { drawText } from "../../render/text";
import { Widget } from "../Widget";

export type ButtonTone = "primary" | "neutral" | "danger";

const TONES: Record<ButtonTone, readonly string[]> = {
  primary: NEON,
  neutral: STEEL,
  danger: EMBER,
};

/** Bevelled arcade plate with dithered face, inset label and a real pressed state. */
export class Button extends Widget {
  tone: ButtonTone = "primary";
  label: string;

  constructor(x: number, y: number, w: number, h: number, label: string, tone?: ButtonTone) {
    super(x, y, w, h);
    this.label = label;
    if (tone) this.tone = tone;
  }

  override draw(ctx: CanvasRenderingContext2D, focused: boolean, time: number): void {
    const { x, y, w, h } = this.rect;
    const ramp = TONES[this.tone];
    const press = this.pressBlend;
    const lift = 4 * (1 - press);
    const hover = this.hoverBlend;
    const chamfer = 8;

    ctx.save();

    // Cast shadow under the plate; it collapses as the button is pressed.
    ctx.globalAlpha = 0.55 * (1 - press * 0.8);
    ctx.fillStyle = VOID[0];
    pathChamferRect(ctx, x + 3, y + 4 + lift * 0.4, w, h, chamfer);
    ctx.fill();
    ctx.globalAlpha = 1;

    const py = y - lift;

    // Face.
    pathChamferRect(ctx, x, py, w, h, chamfer);
    ctx.save();
    ctx.clip();
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const base = 0.18 + hover * 0.25 - press * 0.12;
      setDitherFill(ctx, VOID[1], ramp[ramp.length - 1] as string, base + (1 - t) * 0.35);
      ctx.fillRect(x, py + (h * i) / bands, w, h / bands + 1);
    }
    // Hover sheen sweeping across the plate.
    if (hover > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = hover * 0.16;
      const sweep = ((time * 0.35) % 1) * (w + 80) - 40;
      setDitherFill(ctx, VOID[0], BONE[2], 0.6);
      ctx.beginPath();
      ctx.moveTo(x + sweep, py + h);
      ctx.lineTo(x + sweep + 26, py);
      ctx.lineTo(x + sweep + 46, py);
      ctx.lineTo(x + sweep + 20, py + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Rim: lit on top, dark underneath.
    pathChamferRect(ctx, x + 0.9, py + 0.9, w - 1.8, h - 1.8, chamfer);
    ctx.strokeStyle = withAlpha(BONE[2], 0.25 + hover * 0.4 - press * 0.15);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (focused) {
      strokeCornerBrackets(
        ctx,
        x - 6,
        py - 6,
        w + 12,
        h + 12,
        12,
        withAlpha(ramp[ramp.length - 1] as string, 0.6 + 0.35 * Math.sin(time * 6)),
        2,
      );
    }

    const disabled = !this.enabled;
    drawText(ctx, this.label, x + w * 0.5, py + h * 0.5 - this.rect.h * 0.19, {
      size: h * 0.38,
      color: disabled ? STEEL[2] : BONE[2],
      weight: "heavy",
      align: "center",
      tracking: 0.2,
      alpha: disabled ? 0.5 : 1,
      shadow: { dx: 0, dy: 0.06, color: withAlpha(VOID[0], 0.8) },
      glow: hover > 0.02 ? { color: ramp[ramp.length - 1] as string, width: 0.1, alpha: hover * 0.6 } : undefined,
    });

    ctx.restore();
  }
}
