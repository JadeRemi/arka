import { DROPS } from "../../config/feel";
import type { DropPool } from "../../game/Drops";
import { setDitherFill } from "../dither";
import { BONE, VOID, shade, withAlpha } from "../palette";
import { pathChamferRect } from "../shapes";
import { drawText } from "../text";

/**
 * Power-up capsules. Deliberately the brightest thing in the field other than the ball: a
 * dropping capsule is a decision the player has a second or two to make, so it has to read
 * instantly, and a hazard has to read as a hazard before it is caught.
 */
export function drawDrops(ctx: CanvasRenderingContext2D, pool: DropPool): void {
  if (pool.count === 0) return;
  const w = DROPS.width;
  const h = DROPS.height;

  ctx.save();
  for (let i = 0; i < pool.count; i++) {
    const spec = pool.specAt(i);
    const cx = pool.x[i] as number;
    const cy = pool.y[i] as number;
    const age = pool.age[i] as number;
    const ramp = spec.ramp;

    // Hazards pulse fast; benign capsules breathe slowly.
    const pulse = spec.hazard
      ? 0.55 + 0.45 * Math.sin(age * DROPS.hazardPulseRate)
      : 0.7 + 0.3 * Math.sin(age * 2.6);

    const x = cx - w * 0.5;
    const y = cy - h * 0.5;

    // Halo, so a capsule is visible against the busiest part of the background.
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.16 * pulse;
    ctx.fillStyle = shade(ramp, 1);
    pathChamferRect(ctx, x - 8, y - 7, w + 16, h + 14, 10);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // Shell.
    pathChamferRect(ctx, x, y, w, h, 6);
    ctx.save();
    ctx.clip();
    const bands = 6;
    for (let b = 0; b < bands; b++) {
      const t = b / (bands - 1);
      setDitherFill(ctx, shade(ramp, 0), shade(ramp, ramp.length - 1), 0.2 + (1 - t) * 0.62);
      ctx.fillRect(x, y + (h * b) / bands, w, h / bands + 1);
    }
    // Banded flanks, which is what makes it read as a capsule rather than a tile.
    ctx.fillStyle = withAlpha(VOID[0], 0.4);
    for (let s = 4; s < w; s += 7) ctx.fillRect(x + s, y, 1.4, h);
    ctx.restore();

    // Rim: brighter on a hazard, so the outline alone carries the warning.
    pathChamferRect(ctx, x + 0.9, y + 0.9, w - 1.8, h - 1.8, 6);
    ctx.strokeStyle = withAlpha(spec.hazard ? shade(ramp, 3) : BONE[2], 0.45 + pulse * 0.45);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawText(ctx, spec.glyph, cx, y + h * 0.5 - h * 0.34, {
      size: h * 0.68,
      color: BONE[2],
      weight: "heavy",
      align: "center",
      tracking: 0.1,
      shadow: { dx: 0, dy: 0.08, color: withAlpha(VOID[0], 0.9) },
      glow: { color: shade(ramp, 3), width: 0.12, alpha: 0.35 + pulse * 0.35 },
    });

    // Trailing spark, so the eye follows the fall.
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = shade(ramp, 2);
    const tail = 5 + Math.sin(age * 9 + i) * 2;
    ctx.fillRect(cx - 1.2, y - tail, 2.4, tail);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
