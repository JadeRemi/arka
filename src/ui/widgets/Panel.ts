import { setDitherFill } from "../../render/dither";
import { BONE, STEEL, VOID, withAlpha } from "../../render/palette";
import { pathChamferRect, strokeCornerBrackets } from "../../render/shapes";
import { drawText } from "../../render/text";

/** Framed plate with corner brackets and an optional title tab. Purely decorative. */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title?: string,
): void {
  ctx.save();

  ctx.globalAlpha = 0.62;
  ctx.fillStyle = VOID[0];
  pathChamferRect(ctx, x + 5, y + 7, w, h, 14);
  ctx.fill();
  ctx.globalAlpha = 1;

  pathChamferRect(ctx, x, y, w, h, 14);
  ctx.save();
  ctx.clip();
  const bands = 12;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    setDitherFill(ctx, VOID[0], STEEL[0], 0.16 + (1 - t) * 0.34);
    ctx.fillRect(x, y + (h * i) / bands, w, h / bands + 1);
  }
  // Faint horizontal rules, the arcade-panel idiom.
  ctx.fillStyle = withAlpha(BONE[2], 0.04);
  for (let ry = y + 14; ry < y + h - 10; ry += 7) ctx.fillRect(x + 10, ry, w - 20, 1);
  ctx.restore();

  pathChamferRect(ctx, x + 1, y + 1, w - 2, h - 2, 14);
  ctx.strokeStyle = withAlpha(STEEL[3], 0.6);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  strokeCornerBrackets(ctx, x - 5, y - 5, w + 10, h + 10, 20, withAlpha(STEEL[3], 0.55), 2);

  if (title) {
    const tw = 24 + title.length * 13;
    pathChamferRect(ctx, x + 22, y - 15, tw, 30, 8);
    ctx.fillStyle = VOID[1];
    ctx.fill();
    ctx.strokeStyle = withAlpha(STEEL[3], 0.7);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    drawText(ctx, title, x + 22 + tw * 0.5, y - 15 + 9, {
      size: 13,
      color: BONE[1],
      weight: "heavy",
      align: "center",
      tracking: 0.28,
    });
  }

  ctx.restore();
}
