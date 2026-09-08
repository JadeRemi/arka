import { setDitherFill } from "../../render/dither";
import { BONE, STEEL, VOID, withAlpha } from "../../render/palette";
import { pathChamferRect, strokeCornerBrackets } from "../../render/shapes";
import { Widget } from "../Widget";

export type IconGlyph = "pause" | "play";

/**
 * A compact square control drawn with a vector glyph rather than text. Exists for the
 * touch pause button, where there is no keyboard to reach for and no room for a label.
 */
export class IconButton extends Widget {
  icon: IconGlyph;

  constructor(x: number, y: number, size: number, icon: IconGlyph) {
    super(x, y, size, size);
    this.icon = icon;
  }

  override draw(ctx: CanvasRenderingContext2D, focused: boolean, time: number): void {
    const { x, y, w, h } = this.rect;
    const press = this.pressBlend;
    const lift = 3 * (1 - press);
    const py = y - lift;

    ctx.save();

    ctx.globalAlpha = 0.5 * (1 - press * 0.8);
    ctx.fillStyle = VOID[0];
    pathChamferRect(ctx, x + 2, y + 3, w, h, 7);
    ctx.fill();
    ctx.globalAlpha = 1;

    pathChamferRect(ctx, x, py, w, h, 7);
    ctx.save();
    ctx.clip();
    setDitherFill(ctx, VOID[1], STEEL[3], 0.22 + this.hoverBlend * 0.24 - press * 0.1);
    ctx.fillRect(x, py, w, h);
    ctx.restore();
    pathChamferRect(ctx, x + 0.9, py + 0.9, w - 1.8, h - 1.8, 7);
    ctx.strokeStyle = withAlpha(BONE[2], 0.28 + this.hoverBlend * 0.35);
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = BONE[2];
    const cx = x + w * 0.5;
    const cy = py + h * 0.5;
    if (this.icon === "pause") {
      const barW = w * 0.11;
      const barH = h * 0.36;
      ctx.fillRect(cx - barW * 1.9, cy - barH * 0.5, barW, barH);
      ctx.fillRect(cx + barW * 0.9, cy - barH * 0.5, barW, barH);
    } else {
      const r = h * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx - r * 0.7, cy + r);
      ctx.closePath();
      ctx.fill();
    }

    if (focused) {
      strokeCornerBrackets(
        ctx,
        x - 5,
        py - 5,
        w + 10,
        h + 10,
        9,
        withAlpha(STEEL[3], 0.6 + 0.35 * Math.sin(time * 6)),
        2,
      );
    }
    ctx.restore();
  }
}
