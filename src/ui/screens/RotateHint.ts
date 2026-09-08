import { DESIGN_H, DESIGN_W } from "../../core/Viewport";
import { setDitherFill } from "../../render/dither";
import { BONE, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { pathChamferRect } from "../../render/shapes";
import { drawText } from "../../render/text";

/**
 * Shown when a touch device is held in portrait. The field is a fixed 16:9 and a portrait
 * phone would letterbox it down to an unplayable strip, so asking for a rotate is better than
 * silently handing the player a postage stamp.
 */
export function drawRotateHint(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.fillStyle = withAlpha(VOID[0], 0.94);
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  const cx = DESIGN_W * 0.5;
  const cy = DESIGN_H * 0.44;

  // A phone outline that tips back and forth, which says "rotate" without any words.
  const tilt = -0.35 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.9));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  const w = 108;
  const h = 186;
  pathChamferRect(ctx, -w * 0.5, -h * 0.5, w, h, 14);
  ctx.save();
  ctx.clip();
  setDitherFill(ctx, VOID[1], STEEL[2], 0.4);
  ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
  ctx.restore();
  ctx.strokeStyle = withAlpha(NEON[0], 0.8);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = withAlpha(BONE[2], 0.5);
  ctx.fillRect(-14, -h * 0.5 + 9, 28, 4);
  ctx.restore();

  drawText(ctx, "rotate", cx, cy + 128, {
    size: 40,
    color: BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.3,
    glow: { color: NEON[1], width: 0.06, alpha: 0.4 },
  });
  drawText(ctx, "arka plays in landscape", cx, cy + 184, {
    size: 13,
    color: STEEL[3],
    align: "center",
    tracking: 0.42,
    weight: "light",
  });

  ctx.restore();
}
